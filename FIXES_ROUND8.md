# Round 8 Fixes

## Reward ad → unlock audio, still failing — made it bulletproof
Round 6 fixed this by switching the rewarded ad's "loaded" listener from
`AdEventType.LOADED` to `RewardedAdEventType.LOADED`, based on the
documented API pattern for `react-native-google-mobile-ads`. Since it's
still failing for you, I can't be fully certain which constant your exact
installed version (15.8.0) actually fires without a live log at the moment
of failure — so instead of guessing again, `ads/AdManager.js` now listens
for **both** `RewardedAdEventType.LOADED` and `AdEventType.LOADED` on the
same ad instance. Whichever one the library actually emits will correctly
flip `rewardedLoaded = true` — this removes the guesswork entirely rather
than betting on one constant being right.

Also hardened the flow itself:
- The ready-wait timeout increased from 6s to 8s.
- If nothing's ready by the time we'd give up, it now **forces a fresh
  load attempt** instead of just failing — so a stuck state can't keep
  failing indefinitely; the very next tap gets a clean retry.
- Added detailed `console.log` at every decision point (`[Ads] Requesting
  a rewarded ad...`, `[Ads] Rewarded ad ready (via ...)`, `[Ads] Rewarded ad
  failed to load: ...`, `[Ads] showRewarded: rewardedLoaded = ...`, `[Ads]
  Rewarded ad closed. Earned: ...`), so if this ever happens again, the
  Metro log will show exactly which step failed and why — no more guessing.
- The in-app "Not unlocked" message now offers a **Retry** button that
  immediately tries again, instead of requiring you to close and reopen the
  unlock sheet.

## If it happens again
Please grab the Metro/logcat output from the moment you tap "Watch Ad" —
with the new logging, it will show one of:
- `[Ads] Rewarded ad ready (via ...)` never appearing at all → a genuine
  ad-serving issue (network, or Google's test ad servers), not a code bug.
- `[Ads] Rewarded ad failed to load: <reason>` → the SDK is telling us why.
- `[Ads] showRewarded: rewardedLoaded = false, rewardedLoading = ...` →
  tells us exactly what state it was in when you tapped.
That will let me fix the exact remaining cause precisely instead of another
round of best-guessing.

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
