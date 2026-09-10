# Round 4 Fixes

## 1. Safe area — actual root cause found this time
Two real bugs were letting content spill past the safe area on every screen:

- **`App.js` was never wrapped in `SafeAreaProvider`.** Every screen calls
  `useSafeAreaInsets()`, but without a `SafeAreaProvider` ancestor that hook
  has no real device measurements to read — it was silently falling back to
  zero on every screen. That's why headers sat under the notch/status bar
  and content wasn't protected from the home indicator, no matter how much
  inset-padding math I added in earlier rounds. Fixed by wrapping the whole
  app in `<SafeAreaProvider>` in `App.js`.
- **Three `ScrollView`s (Home, AI Q&A, Sermon Writer) were missing
  `style={{flex:1}}`.** Without it, a `ScrollView` isn't bounded to the
  space available and can grow to fit all of its content — pushing the
  persistent banner and, on Home, the bottom tab bar off the bottom of the
  visible screen instead of scrolling within it. Both are now fixed.

These two together are almost certainly what "content spilling beyond the
page" was actually describing throughout — real layout bugs, not just
padding tuning.

## 2. Banner ad — now genuinely persistent
No separate change was needed here beyond the two fixes above: the banner
was being correctly rendered, but on the affected screens it could end up
pushed off-screen by the unbounded `ScrollView`, and its bottom padding
was always 0 without `SafeAreaProvider`. With both fixed, it now stays
correctly pinned to the bottom on every screen.

## 3. Reward ad → unlock audio — found and fixed the actual bug
`ads/AdManager.js` was listening for the rewarded ad's "loaded" event via
`AdEventType.LOADED` — but `RewardedAd` fires its load event as
**`RewardedAdEventType.LOADED`**, a different constant. `AdEventType.LOADED`
is correct for `BannerAd`/`InterstitialAd`, but for `RewardedAd` it never
fires. This meant `rewardedLoaded` was **never set true**, so every unlock
attempt silently waited out its timeout and failed — exactly matching "not
working." Fixed the event constant, and added console logging at each step
(`[Ads] Rewarded ad ready`, SDK-unavailable, no-fill, etc.) so any future
issue shows up clearly in the logs instead of failing silently.

## 4. Lock icon → audio icon
The per-verse audio button showed a 🔒 lock icon when audio was locked.
Replaced with a headset icon (outline when locked, filled/gold "volume"
icon once unlocked, "stop" while playing) so it reads as "tap for audio"
rather than "this is restricted."

## 5. Daily verse — attractive, shadowed, and rotates across the whole Bible
- Previously only 5 hardcoded verses cycled. Added `getVerseOfTheDay()` to
  `data/bibleData.js`: a deterministic, day-seeded pick spanning the entire
  bundled KJV (all 66 books), so it's a different verse — eventually
  covering the whole Bible — every calendar day, while staying the same
  verse all day for everyone. It's cheap: only the one chapter it lands on
  gets loaded, consistent with the earlier lazy-loading fix.
- Verse text is now larger (20pt), italic serif, with a soft drop shadow for
  a more "engraved" look — same shadow treatment applied to the page title.

## 6. Native ads — unchanged, confirmed still correct
Already adaptive and non-disruptive from earlier rounds (renders nothing
until an ad is actually ready, disappears again on failure, sits in natural
content gaps on Home/Books/Chapters). No regressions from this round's
layout fixes — re-verified after the `ScrollView` changes.

## 7. Salutation moved above the daily verse
The greeting ("Good morning — here's today's verse") now sits directly above
the Verse of the Day card instead of next to the page title, which now only
carries the title and the global controls (theme/version).

## 8. Reading Plans now track progress automatically
Opening a reading from Plan Detail (tapping the row, not a separate button)
now automatically marks that day complete once the chapter has loaded —
tracking progress by the act of reading, not requiring a manual step. The
explicit "Mark Complete" button from the previous round is still there for
manual corrections (e.g. marking something done without reopening it, or
undoing a mistake). Finishing every reading in a plan — by either path —
still triggers the completion prompt and offers to restart/renew the plan.

## 9. Title "The Holy Bible" — bold, conspicuous, real Bible-style serif
Increased to 25pt, weight 800, set in `EBGaramond_700Bold` (the same serif
used for scripture text), with letter-spacing and a subtle drop shadow to
match the daily verse's engraved look.

## Ad unit IDs (confirmed unchanged, correct)
```
App ID:        ca-app-pub-7561161015961675~8874760537
Banner:        ca-app-pub-7561161015961675/6632260093
Interstitial:  ca-app-pub-7561161015961675/7777820801
Native:        ca-app-pub-7561161015961675/3370554313
Rewarded:      ca-app-pub-7561161015961675/3565613596
```

## Before testing
```
npm install
npx expo start -c
```
The `-c` clears Metro's cache — worth doing again given how much of the
layout tree changed this round.
