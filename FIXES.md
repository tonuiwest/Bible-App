# Bible App — Production Cleanup Notes

## The critical bug (why the app "wasn't working right")
`data/bibleData.js` tried to load `assets/bibles/kjv.json`, a path that never
existed (the real bundled file is `assets/kjv.json`). Every chapter load was
silently failing and falling back to 5 hardcoded Genesis 1 verses — so every
book, chapter, and version showed the exact same text. This is now fixed:
`scripts/buildKjvIndex.js` builds `data/kjv-index.json`, a clean, fully
indexed 31,100-verse King James Bible, from your real bundled source.

## 1. Real paper-Bible theme, font, and colour
- EB Garamond (scripture) + Inter (UI) were already installed as
  dependencies but never actually loaded — fixed in `App.js` with a proper
  `expo-font` `useFonts` call, gated behind the splash screen.
- `context/ThemeContext.js` is the single theme source of truth (deleted two
  duplicate/conflicting theme files that other screens weren't even using).
  Its parchment/gold "Light" palette and near-black "Dark" palette are kept —
  they already read as an authentic printed-Bible look.

## 2. Version switching on any page/verse
- `data/bibleData.js` now supports **KJV** (bundled, instant, fully offline)
  plus **WEB / ASV / BBE** (fetched from bible-api.com — free, no key — the
  first time a chapter is opened, then cached to AsyncStorage so it's
  offline after that). If a fetch fails, it gracefully falls back to KJV
  text rather than breaking the screen.
- New `components/VersionSwitcher.js` — a small tappable badge + picker
  modal — is now mounted on **Home, Books, Chapters, and Verse** screens, so
  the version can be changed from anywhere, and the change applies
  everywhere instantly via `VersionContext`.

## 3. Ads wired correctly
Consolidated four different, conflicting ad-manager implementations into
one: `ads/AdManager.js`, with real unit IDs in production and Google's
official test IDs in `__DEV__` (so nobody serves/taps real ads while
developing).

- **Interstitial** — capped by a 3-minute cooldown and a minimum interaction
  count; only triggered at natural breaks (leaving a chapter, opening a new
  book), never mid-reading. Occasional and non-disruptive per spec.
- **Native** — `components/NativeAdCard.js` loads lazily and renders
  **nothing at all** until an ad is ready, and disappears again if loading
  fails, so it never leaves a broken placeholder. It's placed in natural
  content gaps: the Home screen (between "Start Reading" and the AI tools)
  and above the Books grid.
- **Banner** — `components/PersistentBanner.js` is now docked to the bottom
  of *every* screen (Home, Books, Chapters, Verse, Search, Bookmarks, AI
  Q&A, Sermon Writer, Plans, Plan Detail). Previously only 3 of 10 screens
  had it, and Home showed a fake hardcoded "Test Ad" box instead of a real
  banner.
- **Rewarded → unlocks audio** — a single watched ad now unlocks read-aloud
  for 1 hour, using one consistent AsyncStorage key everywhere (previously
  two different keys were used by two different, disconnected pieces of
  code).

## Other things fixed along the way
- **Bookmarks were dead**: nothing ever wrote to the storage key the
  Bookmarks screen read from. Verse selection now has a real
  Bookmark/Share action bar, and Bookmarks supports deleting entries.
- **Reading Plans were broken**: `PlannerContext.js` used book IDs (`jn`,
  `ro`, `ep`, `pr`, `mt`, `mk`, `ps`, `ex`) that didn't match the app's real
  book IDs (`jhn`, `rom`, `eph`, `pro`, `mat`, `mrk`, `psa`, `exo`), so most
  plan entries silently failed to resolve a book. Fixed, and opening a
  passage now marks it read.
- **AI Q&A and Sermon Writer were hardcoded mocks** (`setTimeout` returning
  the same canned text regardless of input) despite a genuine, topic-aware
  content module (`utils/aiBible.js`) already existing unused in the repo.
  Both screens are now wired to it.
- Removed ~25 dead/duplicate files: 4 ad managers → 1, 3 theme contexts → 1,
  several unreachable/broken screens (never registered in navigation),
  and ~12MB of duplicate bundled Bible text (three separate full copies of
  the same public-domain KJV in different formats).
- Removed unused npm dependencies (`bible-kjv`, `expo-av`, `expo-clipboard`,
  `expo-notifications`, `expo-sharing`, `react-native-view-shot`,
  `@react-native-picker/picker`, `@react-navigation/bottom-tabs`,
  `@react-navigation/stack`) that nothing in the code imported.

## Before you build
```
npm install
npx expo start          # dev, uses Google's test ad units automatically
eas build --profile production   # release build, uses your real ad units
```
`__DEV__` controls test vs. real ad units automatically — no manual toggle
needed (`constants/ads.js`).

## Known limitation worth knowing about
Verse **search** only searches the bundled KJV text (WEB/ASV/BBE aren't
indexed locally — only fetched per-chapter on demand), so search results are
always KJV references regardless of the reader's currently selected
version. This is a reasonable trade-off to keep search instant and fully
offline; let me know if you'd rather have per-version search and I can wire
it up (it would need to fetch/cache each search candidate remotely, so it'd
be slower and require network for non-KJV searches).
