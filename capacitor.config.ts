import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unitree.go2.controller',
  appName: 'Unitree Go2',
  webDir: 'dist',
  plugins: {
    // Route all fetch/XHR calls through native iOS HTTP stack.
    // This bypasses CORS restrictions for the Unitree cloud API.
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      // Hidden on launch; main.ts calls StatusBar.hide() after Capacitor is ready
      style: 'dark',
      backgroundColor: '#000000',
      overlaysWebView: true,
    },
  },
  ios: {
    // Allow HTTP connections to local robot (non-HTTPS)
    allowsLinkPreview: false,
    scrollEnabled: false,
    // Extend the WebView to fill the entire screen edge-to-edge
    contentInset: 'never',
  },
};

export default config;
