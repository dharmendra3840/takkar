package info.takkar.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * In-app updates outside the Play Store: downloads the new APK, checks it is this app, signed with
 * the same key and a newer build, then hands it to Android's own "Update" prompt. Android keeps the
 * app's data, because the signing key matches.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String FILE_NAME = "takkar-update.apk";
    private static final int MAX_BYTES = 100 * 1024 * 1024;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private volatile boolean busy = false;

    @Override
    public void load() {
        // An update that was already installed (or is older) is just taking space.
        File f = updateFile();
        if (f.exists()) {
            PackageInfo info = archiveInfo(f);
            if (info == null || versionCode(info) <= versionCode(installedInfo())) f.delete();
        }
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", installAllowed());
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    /** Downloads the APK at "url" and checks it. Sends "progress" events ({ percent }). */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        boolean debuggable = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!url.startsWith("https://") && !(debuggable && url.startsWith("http://"))) {
            call.reject("The update address must use https.", "BAD_URL");
            return;
        }
        if (busy) {
            call.reject("An update is already downloading.", "BUSY");
            return;
        }
        busy = true;
        io.execute(() -> {
            File part = new File(updateDir(), FILE_NAME + ".part");
            try {
                fetch(url, part);
                PackageInfo info = archiveInfo(part);
                if (info == null) throw new UpdateError("The download is not a working Android app.", "BAD_APK");
                PackageInfo mine = installedInfo();
                if (!getContext().getPackageName().equals(info.packageName)) throw new UpdateError("The download is a different app.", "BAD_APK");
                if (!sameSigner(info, mine)) throw new UpdateError("The download is not signed by Takkar.", "BAD_SIGNATURE");
                if (versionCode(info) <= versionCode(mine)) throw new UpdateError("You already have the newest version.", "NOT_NEWER");
                File done = updateFile();
                done.delete();
                if (!part.renameTo(done)) throw new UpdateError("Could not save the update.", "IO");
                JSObject r = new JSObject();
                r.put("versionName", info.versionName);
                r.put("versionCode", versionCode(info));
                call.resolve(r);
            } catch (UpdateError e) {
                part.delete();
                call.reject(e.getMessage(), e.code);
            } catch (Exception e) {
                part.delete();
                call.reject("The download did not finish. Check your internet and try again.", "NETWORK");
            } finally {
                busy = false;
            }
        });
    }

    /** Opens Android's install prompt for the downloaded update. */
    @PluginMethod
    public void install(PluginCall call) {
        File f = updateFile();
        if (!f.exists()) {
            call.reject("Download the update first.", "NO_FILE");
            return;
        }
        if (!installAllowed()) {
            call.reject("Allow Takkar to install updates first.", "NOT_ALLOWED");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        // Started from our activity (not a new task), so a cancelled or failed earlier prompt never comes back.
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(i);
        call.resolve();
    }

    // ---------- helpers ----------

    private void fetch(String address, File out) throws Exception {
        URL url = new URL(address);
        HttpURLConnection c = null;
        // GitHub sends release downloads through a redirect; follow a few by hand so https never drops to http.
        for (int hops = 0; hops < 5; hops++) {
            c = (HttpURLConnection) url.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            int status = c.getResponseCode();
            if (status >= 300 && status < 400) {
                URL next = new URL(url, c.getHeaderField("Location"));
                c.disconnect();
                if ("https".equals(url.getProtocol()) && !"https".equals(next.getProtocol())) throw new UpdateError("The update address must use https.", "BAD_URL");
                url = next;
                continue;
            }
            if (status != 200) throw new UpdateError("The update is not available right now.", "HTTP_" + status);
            break;
        }
        if (c == null || c.getResponseCode() != 200) throw new UpdateError("The update is not available right now.", "REDIRECTS");
        long total = c.getContentLengthLong();
        if (total > MAX_BYTES) throw new UpdateError("The update is too large.", "TOO_LARGE");
        try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
            byte[] buf = new byte[64 * 1024];
            long got = 0;
            int lastPercent = -1;
            int n;
            while ((n = in.read(buf)) != -1) {
                got += n;
                if (got > MAX_BYTES) throw new UpdateError("The update is too large.", "TOO_LARGE");
                os.write(buf, 0, n);
                if (total > 0) {
                    int percent = (int) (got * 100 / total);
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject p = new JSObject();
                        p.put("percent", percent);
                        notifyListeners("progress", p);
                    }
                }
            }
        } finally {
            c.disconnect();
        }
    }

    private boolean installAllowed() {
        if (Build.VERSION.SDK_INT >= 26) return getContext().getPackageManager().canRequestPackageInstalls();
        return true; // Android 7 and older ask in the install prompt itself
    }

    private File updateDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        dir.mkdirs();
        return dir;
    }

    private File updateFile() {
        return new File(updateDir(), FILE_NAME);
    }

    @SuppressWarnings("deprecation")
    private PackageInfo archiveInfo(File f) {
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        return getContext().getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(), flags);
    }

    @SuppressWarnings("deprecation")
    private PackageInfo installedInfo() {
        Context ctx = getContext();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        try {
            return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), flags);
        } catch (PackageManager.NameNotFoundException e) {
            throw new IllegalStateException(e);
        }
    }

    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo p) {
        return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    }

    @SuppressWarnings("deprecation")
    private static Set<String> signers(PackageInfo p) {
        Signature[] sigs;
        if (Build.VERSION.SDK_INT >= 28) sigs = p.signingInfo == null ? null : p.signingInfo.getApkContentsSigners();
        else sigs = p.signatures;
        Set<String> out = new HashSet<>();
        if (sigs != null) for (Signature s : sigs) out.add(s.toCharsString());
        return out;
    }

    private static boolean sameSigner(PackageInfo a, PackageInfo b) {
        Set<String> x = signers(a);
        return !x.isEmpty() && x.equals(signers(b));
    }

    private static class UpdateError extends Exception {
        final String code;

        UpdateError(String message, String code) {
            super(message);
            this.code = code;
        }
    }
}
