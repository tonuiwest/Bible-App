// The bottom dock + banner + safe-area inset now live OUTSIDE every screen
// (see App.js / BottomDock.js), so a screen's own area already ends above
// them. All a scrollable list needs is a little breathing room, plus clearance
// for the raised centre Home button that overlaps the content edge slightly.
const HOME_BUTTON_CLEARANCE = 28;

export function useContentBottomPad(extra = 0) {
  return HOME_BUTTON_CLEARANCE + extra;
}
