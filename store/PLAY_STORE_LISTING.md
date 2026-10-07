# Google Play Store Listing — Optimized

Paste into **Play Console → Grow users → Store presence → Main store listing**.
All lengths checked against Play limits. Copy avoids terms Play rejects in
titles/short descriptions ("best", "#1", "free", "top", emoji, ALL CAPS).

---

## App name (30 max)

**Recommended:** `Bible: KJV Audio Bible & Plans` (30)

Alternative to A/B test: `Holy Bible KJV: Audio & Study` (29)

Why: "Bible", "KJV", "Audio Bible" and "Holy Bible" are the highest-volume
search terms in this category; the title is the strongest ranking signal.
KJV is searched far more than WEB/ASV/BBE combined, so it earns the title
slot; the other versions go in the short + full description, which Play
also indexes. (KJV is also the only version bundled offline — the others
load online — so "offline" is only ever claimed for KJV.)

## Short description (80 max)

**Recommended:** `KJV offline plus WEB, ASV & BBE Bibles. Audio, daily verse, plans & AI study.` (77)

## Full description (4000 max)

```
Read, listen to and study the Holy Bible — anywhere, even offline.

Bible: KJV Audio Bible & Plans gives you the complete King James Version in a calm, beautiful parchment design, with audio read-aloud, daily reading plans, verse highlights and an AI Bible study helper — all in one simple app.

📖 READ THE BIBLE OFFLINE
• Complete King James Version (KJV) — Old Testament and New Testament
• KJV works offline: no internet needed to read it
• More translations: WEB (World English Bible), ASV (American Standard Version) and BBE (Bible in Basic English)
• Adjustable text size, clean layout, easy book and chapter navigation

🎧 AUDIO BIBLE
• Listen to any chapter read aloud, verse after verse
• Choose your narrator voice and reading speed
• Follow along as each verse is highlighted while it plays

📅 BIBLE READING PLANS
• Guided daily reading plans, or create your own
• Track your progress and keep your reading streak
• Daily reminder notifications so you never miss a day

✨ AI BIBLE STUDY
• Ask questions about any verse, book, person or topic
• Tap "Explain" on a verse for context and meaning
• Sermon and devotional outlines to help you reflect, teach and preach

🖍 HIGHLIGHT, BOOKMARK & SHARE
• Highlight verses in multiple colors
• Save favorite verses and find them later
• Share Bible verses with friends and family in one tap

🔎 SEARCH THE SCRIPTURES
• Find any word, phrase or verse quickly

🌙 COMFORTABLE READING
• Day (parchment) and Night (dark mode) themes
• Designed for daily devotions, prayer and quiet time

Whether you are reading the Bible for the first time, following a one-year plan, preparing a sermon or Bible study, or simply looking for a daily verse of encouragement, this app helps you grow in God's Word every day.

Download now and start your daily Bible reading today.

"Thy word is a lamp unto my feet, and a light unto my path." — Psalm 119:105 (KJV)
```

Keywords naturally covered (Play indexes the full description — repeat main
terms 3–5 times, never stuff): Bible, Holy Bible, KJV, King James Version,
audio Bible, offline Bible, Bible reading plan, daily verse, Bible study,
devotional, Scripture, Old/New Testament.

---

## Graphics (biggest conversion lever)

**Icon** — keep the gold ring + Bible; ensure it reads at 48px. No text in icon.

**Feature graphic (1024×500)** — parchment background, phone mockup on the
right, left text: "Read & Listen to the Holy Bible". Must look good with the
Play play-button overlay in the centre-left removed (no video) / present.

**Screenshots (portrait 1080×1920, upload all 8)** — first 3 matter most;
each = real screen + 3–5 word caption at the top:

1. Verse reader (Psalm 23 or John 3) — "The Holy Bible, Beautifully"
2. Audio playing bar — "Listen to Every Chapter"
3. Reading plans + streak — "Daily Reading Plans"
4. AI answer on a verse — "Understand Every Verse"
5. Highlights in colors — "Highlight & Save Verses"
6. Dark mode reader — "Day & Night Reading"
7. Translation switcher — "KJV, WEB, ASV & BBE"
8. Home with daily verse — "A Verse for Every Day"

Tablet screenshots (7" and 10") too — required for "Designed for tablets"
visibility, and app declares `supportsTablet`.

**Promo video (optional, high impact)** — 20–30 s screen recording of reading →
listening → plan, uploaded to YouTube, link in listing.

---

## Console settings for visibility

- **Category:** Books & Reference. **Tags:** Bible, Religion, Reference, Books (pick up to 5 in Store settings).
- **Contact details:** email + website + privacy policy URL (missing website lowers trust).
- **Ads declaration:** "Contains ads" = Yes (required; ads are in the app).
- **Content rating / Data safety:** complete accurately — AdMob collects device IDs & approximate location for ads; declare this or the listing can be rejected.
- **Custom store listings (Grow → Store presence):** add localized listings for high-volume Bible markets: Spanish, Portuguese (Brazil), French, Swahili, Tagalog, Indonesian, Korean. Even translating only title + short + full description lifts installs there.
- **Store listing experiments:** run one at a time for 2–4 weeks — 1) icon, 2) first screenshot, 3) short description.
- **Ratings:** add Google's in-app review prompt (`expo-store-review`) after a positive moment (e.g. finishing a plan day) — rating and review volume is a top ranking factor. Reply to every review.
- **Android vitals:** keep crash rate < 1.09% and ANR < 0.47%; worse thresholds suppress ranking.
