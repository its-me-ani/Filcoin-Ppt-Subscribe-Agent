import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aspiring.invoice",
  appName: "Invoice",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    Keyboard: {
      // On Android 15 (SDK 35) with edge-to-edge, native adjustResize is
      // ignored and IonModal (position:fixed) ignores body-resize anyway.
      // We handle repositioning ourselves via the visualViewport API.
      resize: "none",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // Enable edge-to-edge / immersive mode
      overlaysWebView: true,
      style: "DARK",
      // backgroundColor removed: triggers deprecated Window.setStatusBarColor on Android 15 (SDK 35).
      // Edge-to-edge transparency is handled natively by EdgeToEdge.enable() in MainActivity.
    },
  },
};

export default config;
