# Round 2 Fixes

## Crash after prolonged use — likely cause found and fixed
`components/NativeAdCard.js` created a fresh native ad object every time it
mounted (every visit to Home, Books, or Chapters — all stack screens that
remount on each navigation) but never released the previous ones. Native ad
objects hold real native-side memory (images, media). Over a longer session
of browsing back and forth, this was very likely leaking into an eventual
out-of-memory crash. Fixed: the ad is now destroyed (`nativeAd.destroy()`)
whenever the card unmounts or a new one is requested.

Also fixed: speech synthesis (`expo-speech`) was never stopped when leaving
the Verse screen, so audio could keep running in the native module after the
screen was gone — now explicitly stopped on unmount and on back navigation.

## 1. Audio unlock via reward ad — now genuinely global and reliable
Two real bugs, both fixed in `ads/AdManager.js`:
- **Unreliable "not happening"**: `showRewarded()` used to fail instantly if
  the rewarded ad hadn't finished loading yet (common right after launch).
  It now waits up to 6 seconds for the ad to become ready before giving up,
  and the "Watch Ad" button shows a loading state while it waits.
- **A failed ad load never retried**: an ERROR event used to leave
  interstitials/rewarded permanently unloaded for the rest of the session.
  Both now back off 30s and retry automatically.
- The unlock itself was already a single global AsyncStorage key, so once a
  reward is earned, audio is unlocked in **every** book/chapter/verse for the
  full hour — `VerseScreen` now also re-checks this on every screen focus
  (not just mount), so it reflects correctly even after switching verses.

## 2. Reading Plans
- **"Mark Complete" is now an explicit, separate button** on each reading —
  tapping the row still just opens it to read; a distinct button marks/
  unmarks it done, so nothing is auto-completed by accident.
- **Removed the hardcoded green** — completed items/plans now use the same
  gold/parchment palette as the rest of the app instead of a jarring
  `#2E7D32` green.
- **Fixed a real data bug**: progress used to be keyed by `bookId_chapter`
  globally, so two different plans that happened to reference the same
  chapter (e.g. Psalm 23 appearing in two plans) would mark each other
  complete by accident. Progress is now correctly scoped per plan, per day.
- **Plans now renew**: finishing every reading in a plan pops a "Plan
  Complete 🎉" prompt and resets that plan's progress so it can be read
  again, tracking how many times you've completed it (shown as ×2, ×3…).

## 3. Safe area — fixed globally
Added two shared building blocks and applied them to every screen instead of
each screen hand-rolling its own inset math:
- `components/ScreenHeader.js` — consistent top-inset header used on Books,
  Chapters, Search, Bookmarks, Planner, Plan Detail, AI Q&A, and Sermon
  Writer (previously several of these had no top-inset handling at all).
- `components/useContentBottomPad.js` — a shared hook so scrollable content
  always leaves enough room for the persistent bottom banner **and** the
  device's own safe-area inset, instead of a hardcoded `90`.
- The Verse screen's audio-unlock sheet and bottom bookmark/share bar now
  also add `insets.bottom` explicitly.

## 4. AI Q&A — now actually driven by what you type
`utils/aiBible.js` previously only recognized 6 hardcoded topics via crude
keyword matching, and silently fell back to one fixed generic answer for
everything else (the "AI" online path was wired to a Gemini key that was
always empty, so it never activated). Rewritten:
- Matches your question against ~20 topics via real keyword scoring.
- **Also live-searches the bundled KJV** for the significant words you
  actually typed (via `searchVerses`), and pulls the **real verse text** for
  every reference shown — not a canned paragraph, actual Scripture fetched
  for your question.
- The Sermon Writer uses the same engine, so a devotional topic you type is
  what actually shapes the verses and content returned.
- Still fully offline — no API key involved, so nothing to configure.

## 5. Home screen — cleaner and more organized
Reorganized into a clear hierarchy: greeting + global controls (theme/version)
fixed at the top, then Verse of the Day, a single "Continue Reading" call to
action, a tidy 2×2 Quick Access grid (Library / Search / Saved / Plans), the
native ad in its natural gap, then AI tools. Removed redundant/duplicate
elements from the previous layout.

## 6. Light/dark mode toggle
This was the actual bug: `ThemeContext` already supported dark mode and
persisted the preference, but **no button anywhere in the app called
`toggleTheme()`**. Added `components/ThemeToggle.js` (sun/moon icon) and
placed it in the header of every screen — Home, Books, Chapters, Search,
Bookmarks, Planner, AI Q&A, Sermon Writer, and Verse.

## 7. Ad pacing (interstitial/rewarded) and native ad placement
Already implemented in round 1; hardened further in round 2:
- Interstitials only ever fire at natural breaks (leaving a chapter, opening
  a new book) and are capped by both a 3-minute cooldown and a minimum
  interaction count — never mid-reading.
- A failed load now retries with backoff instead of silently going dark for
  the rest of the session (see crash-fix section above — same mechanism).
- Native ads remain fully adaptive: they render nothing until an ad is
  actually ready, and disappear again if loading fails, so they never leave
  a broken placeholder in the "free space" they occupy (Home, Books,
  Chapters).

## Ad unit IDs (unchanged, confirmed correct)
```
App ID:        ca-app-pub-7561161015961675~8874760537
Banner:        ca-app-pub-7561161015961675/6632260093
Interstitial:  ca-app-pub-7561161015961675/7777820801
Native:        ca-app-pub-7561161015961675/3370554313
Rewarded:      ca-app-pub-7561161015961675/3565613596
```
These are wired in `constants/ads.js` and `app.config.js` and were verified
against what you provided — no changes needed there.

## If the crash still happens
The native-ad-leak fix above is the most likely single cause given the
symptoms ("runs fine, crashes after a while" — classic memory growth), but if
it recurs, the most useful next step is a device crash log (Xcode
Console/`adb logcat` around the crash, or your EAS build's crash reporting if
enabled) — that will show whether it's a native OOM, a JS exception, or
something ad-SDK specific, and I can target the fix precisely.
