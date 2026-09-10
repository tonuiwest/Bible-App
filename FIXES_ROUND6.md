# Round 6 Fixes

## Library crash — root cause found and fixed
Your log pinpointed it exactly:
```
ERROR [TypeError: Cannot read property 'responseId' of undefined]
```
at `NativeMediaView`. In `components/NativeAdCard.js`, `<NativeMediaView>`
was rendered as a **sibling after** `</NativeAdView>` closed, instead of
**inside** it. `NativeMediaView` (like every `NativeAsset`) has to be a
descendant of `NativeAdView` — that's how the native module associates it
with the loaded ad response. Rendered outside, there's no response to
attach to, hence "responseId of undefined." This only crashed when an ad
happened to load with video/image media content, which is why it wasn't
caught in earlier testing but hit reliably once you opened Library and a
richer ad loaded.

Fixed by moving `NativeMediaView` inside `<NativeAdView>` alongside the
icon/headline/body/CTA row. Also re-verified: `BannerAd`, `InterstitialAd`,
and `RewardedAd` don't have this same nesting requirement, so nothing else
in the codebase had the same bug.

## Home page — proportions fixed
The daily-verse card had `flex: 1`, which stretched it to absorb all
leftover vertical space — looking oversized on taller screens. Removed
`flex: 1`; the card is now sized to its own content (compact padding,
5-line cap) like every other section. To keep the page still feeling
evenly composed instead of top-heavy, the outer container now uses
`justifyContent: 'space-between'`, which distributes any leftover space as
small even gaps between all the sections rather than inflating any single
one.

## Home page — header no longer spills/clips, title is bigger and bolder
The title and the theme/version controls were sharing one row — fine at the
previous smaller title size, but "The Holy Bible" bigger and bolder (as
requested) would have crowded or clipped the controls on narrower phones.
Restructured into two rows:
- **Row 1**: title alone, full width — now 30pt, weight 800, in
  `EBGaramond_700Bold` (the same real Bible serif used throughout the app),
  with a stronger drop shadow.
- **Row 2**: the salutation (left, still immediately above the daily verse)
  and the theme/version controls (right), which no longer compete with the
  title for horizontal space.
Also added a touch more top padding for breathing room from the status bar.

## General production-readiness pass
Re-ran full validation across every file: brace/paren/bracket balance,
resolvable relative imports, and a scan for JSX elements used without a
matching import. Everything checks out clean; no other issues found.

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
The `-c` clears Metro's bundler cache — worth doing again since a crashing
component changed.
