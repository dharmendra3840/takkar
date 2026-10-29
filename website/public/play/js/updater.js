// In-app updates on Android (0.5.1 and newer): download the new APK, then Android's own "Update" prompt.
// Older APKs and the web app have no plugin, so they keep opening the beta page.
import { IS_NATIVE } from './config.js?v=81531dd943';

const plugin = () => window.Capacitor?.Plugins?.AppUpdater;

export const canSelfUpdate = () => IS_NATIVE && !!plugin();

/** Resolves { versionName, versionCode } once the APK is downloaded and checked. */
export async function downloadUpdate(url, onProgress) {
  const listener = await plugin().addListener('progress', (e) => onProgress(e.percent));
  try {
    return await plugin().download({ url });
  } finally {
    listener.remove();
  }
}

export async function installAllowed() {
  return (await plugin().canInstall()).allowed;
}

export const openInstallSettings = () => plugin().openInstallSettings();
export const installUpdate = () => plugin().install();
