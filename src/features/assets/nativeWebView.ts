import { TurboModuleRegistry } from 'react-native';
import type { WebView as WebViewComponent } from 'react-native-webview';

let cached: typeof WebViewComponent | null | undefined;

/**
 * WebView hanya bila modul native-nya ada di binary. Expo Go tidak membawa RNCWebViewModule: import statis
 * react-native-webview memanggil TurboModuleRegistry.getEnforcing saat modul dievaluasi dan membuat route detail aset
 * (lalu seluruh aplikasi) gagal dimuat. Di sini dicek dulu dengan `get` (tidak melempar), baru di-require.
 */
export function loadWebView(): typeof WebViewComponent | null {
  if (cached !== undefined) return cached;
  try {
    cached = TurboModuleRegistry.get('RNCWebViewModule') ? (require('react-native-webview') as typeof import('react-native-webview')).WebView : null;
  } catch {
    cached = null;
  }
  return cached;
}
