# Round 9 — Modern refresh

## Play Console: "DEX code optimization is below our threshold — Obfuscation (1%)"
`app.config.js` now enables R8 for release builds through `expo-build-properties`
(already a dependency — it just wasn't registered as a plugin):

```js
enableMinifyInReleaseBuilds: true,          // R8 shrink + optimize + obfuscate
enableShrinkResourcesInReleaseBuilds: true, // strip unused resources
extraProguardRules: ...                      // keep rules for the AdMob bridge, AsyncStorage, Hermes JNI
```
Because `android/` is generated, run a clean prebuild before the next build:
```
npx expo prebuild --clean
eas build -p android --profile production
```
After uploading the new bundle, the Obfuscation percentage in "DEX code
optimization" should rise well above the 25% threshold (Play re-evaluates
the bundle after upload; the card can take a few days to refresh).
Test the release build on a device before rolling out (ads, audio, reading).

## Ads — all seven IDs verified and wired
| Format | Unit | Where it shows |
|---|---|---|
| App ID | `~8874760537` | `app.config.js` plugin |
| Banner | `/6632260093` | One anchored adaptive banner for the whole app, under the Home dock (no more re-requesting on every screen) |
| Interstitial | `/7777820801` | Natural breaks only (leaving a chapter, dock navigation, after sharing, AI answers) — 4-minute cooldown |
| Native | `/3370554313` | Bottom of Library, Chapters and Reading Plans |
| Rewarded | `/3565613596` | Unlock audio Bible for 1 hour (falls back to the rewarded-interstitial unit on no-fill) |
| Rewarded interstitial | `/8437847426` | Unlock full AI sermon manuscripts for 20 minutes (opt-in intro sheet; no-fill still gives the sermon) |
| App open | `/7664745246` | When returning to the app after 30s+ away, and on cold start from the 2nd launch; 3-min cooldown, 4-hour cache expiry |

Also added: Google UMP consent (`AdsConsent.gatherConsent`) before any ad
request, a "Privacy choices" link on Home when required, and personalised
ads when consent allows (previously every request was forced non-personalised).
Dev builds still use Google test IDs automatically.

> Please confirm in AdMob that `3565613596` is a **Rewarded** unit and
> `8437847426` is a **Rewarded interstitial** unit — the format of a unit
> must match how the app loads it.

## Daily reading reminder (new)
- Bell icon on Home (and a "Set a daily reading reminder" row) opens a sheet with an
  on/off switch, time picker and presets (Early, Morning, Lunch, Evening, Bedtime).
- The notification previews tomorrow's verse, or today's reading from your active plan
  ("Gospels in 40 Days · Day 5 — Today's reading: Matthew 9–10"). It's refreshed every
  time the app opens so the text stays current.
- Tapping it opens the plan (or Home). Android channel "Daily reading reminder",
  white status-bar icon `assets/notification-icon.png`.
- New dependency: **expo-notifications** — run `npx expo install expo-notifications`
  (or `npm install`) before building.

## Navigation
- Persistent bottom dock on every screen: Bible · Plans · **Home** · Ask AI · Saved,
  with a raised gold Home button, sitting directly above the banner ad.
- Dock + banner hide while typing so the keyboard never covers inputs.

## Home page
Evenly distributed layout: greeting/date + controls, Verse of the Day hero
(Read / Explain / Save / Share), streak · plans · saved stats, real Continue
Reading (last chapter you opened), active reading plan with green progress,
and a 3×2 quick-action grid.

## Reading plans
- Green animated progress bars everywhere.
- 34 plans (was 5): 22 topical, 9 book plans, NT in 90 days, OT in a year, Bible in a year.
- Days can hold several chapters; a day completes when all its readings are opened.
- **Create your own plan**: pick books (or quick sets like Gospels / Paul's Letters),
  optional chapter range, number of days — or hand-pick passages day by day.
- Existing progress on the original five plans is preserved.

## Reader
Previous/next chapter, font size A-/A+, continuous read-aloud, verse highlights
in four colours, "Explain" (sends the selected verses to Ask AI), jump-to-verse
from Search / Saved / AI, reading streak, plan "Next reading" button.

## AI: Ask the Bible & Sermon Writer
Rebuilt as a grounded, offline knowledge engine (`ai/knowledge/*`, `utils/aiBible.js`):
66 book profiles, 36 people, 46 topics, 47 FAQs and Bible stories,
130 verse and chapter commentaries, a 40-word glossary and 29 sermon illustrations.
Every quoted verse is pulled live from the bundled KJV and all ~1,100
references were validated against the text. Answers include context, key
words, related Scripture, application and follow-up questions; a crisis
check routes self-harm messages to real help.

Sermon Writer produces full manuscripts: title, main text, big idea,
introduction with illustration, 2–4 points (each with Scripture,
illustration and application), gospel connection, conclusion, prayer and
discussion questions. Styles: topical / expository / evangelistic; lengths;
audiences. Sermons can be saved and shared.

## Bible text fix
Ten chapters in the bundled KJV had wrong verse divisions or missing verses
(e.g. Matthew 22:34 was missing, so Matthew 22:37 showed verse 38's text).
Fixed: 1 Samuel 20, 1 Kings 22, Matthew 2, 22, 26, Mark 4, 7, 8, 3 John 1, Revelation 12.
The bundled KJV now has the standard 31,102 verses.

## Icon
The Bible inside the golden ring is ~34% larger. New `adaptive-icon.png`
keeps the ring inside Android's safe zone; splash regenerated (the old
splash/adaptive images had an AI-generator watermark in the corner).
Upload `store-icon-512.png` as the Play Store hi-res icon.

## Update — compact Home page & narrator voices
- Home redesigned and decongested: greeting/date no longer collide with the
  header buttons; Verse of the Day card is tighter (and now correctly labelled KJV);
  Continue reading, reading plan progress and daily reminder are one "Today" card
  with a streak chip; the duplicate shortcut grid and stats tiles are gone (Bible,
  Plans, Ask AI and Saved live in the bottom bar). Only Search and Sermon Writer
  remain as Home tools. Paper theme, EB Garamond headings and Inter UI text kept.
- Audio: new Narrator sheet (headset icon in the reader, and "Voice" on the
  now-playing bar) with 6 reading styles (Classic, Deep Narrator, Gentle,
  Storyteller, Elder, Brisk), 5 speeds, and every English voice installed on
  the phone (accents labelled; HD/online voices marked), with live preview.
  "Listen to chapter" button under each chapter number, and a now-playing bar
  with Stop. Settings are remembered.
