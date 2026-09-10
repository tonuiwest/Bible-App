# Round 5 Fixes

## 1. Home page — compacted to one screen, no scrolling
Rebuilt `HomeScreen.js` without a `ScrollView`. Layout is a fixed column:
title + controls, salutation, a flexible daily-verse card (the only element
that grows/shrinks to absorb whatever space is left), a slim "Continue
Reading" button, and a single 3-column grid covering everything that used
to be two separate sections (Library, Search, Saved, Reading Plan, Ask a
Question, Sermon Writer). The redundant bottom tab bar was removed since the
grid already covers the same destinations — that reclaimed the vertical
space needed to make this fit without scrolling. No ad on this screen (see
native ads note below) — a fixed one-page layout can't safely reserve space
for content that loads asynchronously and varies in size.

## 2. Daily verse — now the real Bible font
It was set in an italic variant of the serif font; switched to the exact
same non-italic `EBGaramond_400Regular` used when actually reading Scripture
in the Verse screen, so the daily verse now visually matches the real
in-app Bible typography instead of a decorative italic. Kept the larger
size and soft engraved-style shadow from the last round.

## 3. "Plan" → "Reading Plan"
Renamed every user-facing occurrence: the Home grid entry, the completion
alert ("Reading Plan Complete! 🎉"), and its "Restart Reading Plan" action.
(The Reading Plans list screen's header already said "READING PLANS" from
an earlier round — untouched.)

## 4. Library: Old/New Testament tabs were always empty — found the bug
`data/books.js` has no `testament` field on any book entry at all — the
filter was comparing against `undefined` and could never match "old" or
"new", so both tabs always came back empty while "All" worked fine. Fixed
by deriving the testament from each book's existing canonical number
(1–39 = Old Testament, 27 books = New Testament — verified against the
real data: 39/27/66, matching the tab labels exactly). Also fixed the same
bug in each book card's small "OLD/NEW" label, which was printing literal
"UNDEFINED" before.

## 5. Audio reward — confirmed exactly 1 hour
`AUDIO_UNLOCK_MS = 60 * 60 * 1000` was already exactly one hour; re-verified
and left unchanged, just clarified the comment so it's unambiguous.

## 6. Sharing a verse now triggers an ad
Sharing is a natural completion point, same as leaving a chapter. After the
share sheet closes (and only if the person didn't just cancel it — iOS
reports that reliably, Android doesn't always, so this is best-effort), it
now calls the same `tryShowInterstitial({isNaturalBreak:true})` used
elsewhere — meaning it's still subject to the normal cooldown, so it won't
fire on every single share, just occasionally.

## 7. Native ads — reaffirmed adaptive, kept out of the fixed Home layout
Native ads remain only on Books and Chapters — both scrollable list
screens where a loaded ad can occupy genuine free space without risking
overflow. Added a smooth 280ms fade-in when an ad actually loads (instead
of popping in abruptly), so it never feels like a jarring interruption if
it appears while someone's mid-scroll. Still renders nothing at all until
an ad is ready, and disappears again if loading fails.

## 8. Ad pacing tightened further for "non-disruptive during a session"
- Interstitial cooldown: 3 min → 4 min.
- Minimum interactions before an interstitial can show at all: 4 → 5.
- Interstitials still only ever fire at explicit natural-break points
  (leaving a chapter, opening a new book, finishing a share) — never
  spontaneously while actively reading.

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
