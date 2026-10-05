module.exports = {
  expo: {
    name: "Bible App",
    slug: "bible-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "bibleapp",
    userInterfaceStyle: "automatic",
    splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#F9F1E7" },
    assetBundlePatterns: ["**/*"],
    ios: { bundleIdentifier: "com.wess.bibleapp", supportsTablet: true },
    android: {
      package: "com.wess.bibleapp",
      // Dedicated adaptive-icon foreground: the ring + Bible are scaled to sit
      // inside Android's safe zone, so circle/squircle launcher masks never
      // clip the golden ring.
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#F9F1E7" },
    },
    plugins: [
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-7561161015961675~8874760537",
          // NOTE: iOS needs its own AdMob app (a separate "~..." ID created for
          // the iOS app in AdMob). Replace this when the iOS app is registered.
          iosAppId: "ca-app-pub-7561161015961675~8874760537",
        },
      ],
      [
        "expo-notifications",
        {
          // White-on-transparent silhouette required by Android's status bar.
          icon: "./assets/notification-icon.png",
          color: "#C9A86A",
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            // Fixes Play Console "DEX code optimization is below our threshold —
            // Obfuscation (1%)": R8 now shrinks, optimizes and obfuscates the
            // release DEX, and unused resources are stripped.
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules: [
              "# Google Mobile Ads RN bridge (looked up by name from JS)",
              "-keep class io.invertase.googlemobileads.** { *; }",
              "-dontwarn io.invertase.googlemobileads.**",
              "# AsyncStorage native module",
              "-keep class com.reactnativecommunity.asyncstorage.** { *; }",
              "# Hermes / RN JNI entry points",
              "-keep class com.facebook.hermes.unicode.** { *; }",
              "-keep class com.facebook.jni.** { *; }",
            ].join("\n"),
          },
        },
      ],
    ],
    extra: { eas: { projectId: "bible-app-parchment" } },
  },
};
