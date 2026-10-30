package info.takkar.app;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Edge to edge: the app draws behind see-through status and navigation bars. The page gets the bars'
 * heights (Android's WebView does not report them reliably through CSS env()) and picks the icon colour.
 */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    private float top = 0;
    private float bottom = 0;

    @Override
    @SuppressWarnings("deprecation")
    public void load() {
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            WindowCompat.setDecorFitsSystemWindows(w, false);
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= 29) w.setStatusBarContrastEnforced(false);
            View web = getBridge().getWebView();
            ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                float density = v.getResources().getDisplayMetrics().density;
                top = bars.top / density;
                bottom = bars.bottom / density;
                notifyListeners("insets", sizes());
                return insets;
            });
            ViewCompat.requestApplyInsets(web);
        });
    }

    /** { top, bottom } in CSS pixels. */
    @PluginMethod
    public void getInsets(PluginCall call) {
        call.resolve(sizes());
    }

    /** dark: true on dark screens (white icons), false on light screens (dark icons). */
    @PluginMethod
    public void setStyle(PluginCall call) {
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
            c.setAppearanceLightStatusBars(!dark);
            c.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }

    private JSObject sizes() {
        JSObject r = new JSObject();
        r.put("top", top);
        r.put("bottom", bottom);
        return r;
    }
}
