# Round 7 Fixes

## Home page — layout was scattered, now a cohesive centered group
Your screenshot showed it clearly: `justifyContent: 'space-between'` was
spreading extra space between *every* row individually — a big gap right
after the title, another big gap after the salutation row, another after
the CTA — instead of one clean, evenly-proportioned page. That's what made
"The Holy Bible" look isolated up against the status bar and the salutation
look disconnected from the verse card below it.

Switched the container to `justifyContent: 'center'`: the whole block (title
→ salutation → verse card → CTA → grid) now stacks with its own small,
consistent margins and centers as **one cohesive group** within the
available space. Any leftover room becomes a single, even margin above and
below the whole thing — so the title settles a comfortable distance below
the status bar instead of sitting flush against it, and the salutation sits
directly against the verse card as intended.

## Native ads — moved from the top to the bottom of Books & Chapters
Both screens were showing the native ad as a `ListHeaderComponent` — above
the book grid on Library, and above the chapter grid on a book's Chapters
screen — meaning it was the very first thing seen, ahead of the actual
content. Switched both to `ListFooterComponent` instead, so the ad now
appears in the genuine free space *after* all 66 books, or after every
chapter of the current book — seen only by someone who's scrolled through
the real content, not interrupting it up front.

## Production-readiness check
Re-ran the full validation pass (brace/paren/bracket balance across every
file, resolvable relative imports) after these changes — clean.

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
