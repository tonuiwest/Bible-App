# Round 10 — Android vitals + reminder fix

## Daily reminder stuck on "loading"
- `utils/reminders.js`: notification channel is created *before* asking permission
  (Android 13+ never shows the prompt otherwise, so the request hung forever).
  Permission request, verse lookup and scheduling all have timeouts; errors are caught.
  Enabling clears old scheduled reminders so only one fires per day.
- `components/ReminderSheet.js`: Save uses try/finally so the spinner always stops;
  shows "Couldn't set reminder" on failure.

## Play Console Android vitals
1. Deprecated edge-to-edge APIs → `android.edgeToEdgeEnabled: true` (app.config.js).
2. Large screens → `orientation: "default"`; `plugins/withAndroidVitals.js` removes
   screenOrientation and sets `resizeableActivity="true"`. Check screens in landscape.
3. Bitmap optimization → splash.png 478 KB → 29 KB, adaptive-icon.png 358 KB → 63 KB.
4. R8 optimization → plugin switches `proguard-android.txt` to
   `proguard-android-optimize.txt` (the default file contains -dontoptimize).

## Build
```
npx expo prebuild --clean
eas build -p android --profile production
```
