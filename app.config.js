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
    android: { package: "com.wess.bibleapp", adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#F9F1E7" } },
    plugins: [
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-7561161015961675~8874760537",
          iosAppId: "ca-app-pub-7561161015961675~8874760537"
        }
      ]
    ],
    extra: { eas: { projectId: "bible-app-parchment" } }
  }
};