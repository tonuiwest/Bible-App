# Release notes — Play Console (500 chars max per language)

Paste between the language tags in **Release → Release notes**.
The generated locale drafts are in `store/locales/<locale>.json` under
`listing.releaseNotes`. Machine translations must be reviewed before publishing.
Where a translated draft exceeds Play's 500-character limit, trailing bullets
are removed to fit; review the saved version against the full source before
publishing. After editing the English source, refresh all translated drafts
with `node scripts/generateLocalization.js --store-only --refresh-release-notes`.

```
<en-US>
What's new:
• New parchment design and Dark Mode
• Custom Bible audio voices and playback speed
• Daily reminders and reading-plan streaks
• Ask questions or tap Explain for verse insights
• No ads during reading or audio
• Improved gesture and edge-to-edge support
• Faster, more stable performance
</en-US>
```
