# Round 3 — Immediate crash on open

## Root cause
`data/bibleData.js` was doing `require('./kjv-index.json')` — loading the
**entire King James Bible (4.3MB, 31,100 verses) into memory synchronously**
the moment the app's JS bundle evaluated, before any screen even rendered.
This file is imported (directly or transitively) by `VerseScreen`,
`SearchScreen`, and `utils/aiBible.js` — all of which React Navigation
requires eagerly at `App.js`'s top level to register the navigator, so this
happened on every single app launch, unconditionally.

Loading a multi-megabyte JSON literal like this synchronously at startup is
a well-known React Native/Hermes crash pattern — it can blow past bytecode
string-table limits or simply stall/exceed memory during the JS thread's
very first tick, which matches "crashes immediately on opening" exactly.

## Fix
Split the single 4.3MB file into **66 small per-book JSON files**
(`data/kjv/gen.json`, `data/kjv/exo.json`, … each 4KB–244KB) plus a static
require map (`data/kjv/index.js`). `data/bibleData.js` now lazily loads only
the specific book actually being read, and caches it after that. Opening
the Home screen no longer touches Bible data at all; opening a chapter loads
one small file; a full-text search (the only feature that legitimately needs
the whole Bible) is the only path that loads everything, and only when
actually triggered by the user — not on every launch.

`scripts/buildKjvIndex.js` was updated to produce this new layout, and its
large source file was moved from `assets/kjv.json` (a folder Expo scans and
bundles as app assets) to `scripts/source-data/kjv.json` (dev-tooling only,
never touched at runtime).

## Also fixed while investigating
The project had **no `babel.config.js`** at all (true from the very original
upload, not something introduced later) — added one (`babel-preset-expo`)
and the matching `devDependencies` entries, since a missing Babel config is
also a plausible source of build/runtime instability depending on the exact
Expo CLI/Metro version being used.

## What to do next
Run `npm install` (to pick up the new `babel-preset-expo` dev dependency)
and do a clean start:
```
npx expo start -c
```
The `-c` clears Metro's bundler cache — important here since the cache may
still be holding the old, broken large-JSON bundle from before this fix.

If it still crashes immediately after this, the next most useful thing is
an actual crash log:
- **iOS**: Xcode → Window → Devices and Simulators → your device → "View
  Device Logs", or if using a simulator, the Xcode console output.
- **Android**: `adb logcat *:E` while relaunching the app.
- **EAS builds**: the EAS dashboard's build/crash section, if crash
  reporting is enabled.
That log will show the exact exception rather than us guessing further.
