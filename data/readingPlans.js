import { BOOKS } from './books';

/*
 * Reading-plan library.
 *
 * Every plan is { id, label, description, icon, category, days } where
 * `days` is an array of days and each day is an array of readings
 * { b: bookId, c: chapter }. A day can therefore hold one chapter (topical
 * plans) or several (Bible-in-a-year style plans).
 *
 * IDs and day order of the five original plans (peace, love, faith, healing,
 * purpose) are unchanged so existing users keep their progress.
 */

// "php 4, isa 26" -> one reading per day.  "gen 1|gen 2" -> two readings in one day.
function topical(spec) {
  return spec.split(',').map((d) => d.trim()).filter(Boolean).map((day) =>
    day.split('|').map((r) => {
      const [b, c] = r.trim().split(/\s+/);
      return { b, c: parseInt(c, 10) };
    })
  );
}

/** Every chapter of the given books, in canonical order. */
export function chaptersOf(bookIds) {
  const out = [];
  bookIds.forEach((id) => {
    const book = BOOKS.find((x) => x.id === id);
    if (!book) return;
    for (let c = 1; c <= book.chapters; c++) out.push({ b: id, c });
  });
  return out;
}

/** Splits a chapter list as evenly as possible over `nDays` days. */
export function splitIntoDays(chapters, nDays) {
  const days = [];
  const n = Math.max(1, Math.min(nDays, chapters.length));
  let idx = 0;
  for (let d = 0; d < n; d++) {
    const remainingDays = n - d;
    const remaining = chapters.length - idx;
    const take = Math.ceil(remaining / remainingDays);
    days.push(chapters.slice(idx, idx + take));
    idx += take;
  }
  return days;
}

const range = (from, to) => {
  const a = BOOKS.findIndex((b) => b.id === from);
  const z = BOOKS.findIndex((b) => b.id === to);
  return BOOKS.slice(a, z + 1).map((b) => b.id);
};

export const BOOK_GROUPS = [
  { id: 'all', label: 'Whole Bible', books: BOOKS.map((b) => b.id) },
  { id: 'ot', label: 'Old Testament', books: range('gen', 'mal') },
  { id: 'nt', label: 'New Testament', books: range('mat', 'rev') },
  { id: 'law', label: 'Torah', books: range('gen', 'deu') },
  { id: 'history', label: 'History', books: range('jos', 'est') },
  { id: 'wisdom', label: 'Wisdom & Poetry', books: range('job', 'sng') },
  { id: 'prophets', label: 'Prophets', books: range('isa', 'mal') },
  { id: 'gospels', label: 'Gospels', books: range('mat', 'jhn') },
  { id: 'paul', label: "Paul's Letters", books: range('rom', 'phm') },
  { id: 'general', label: 'General Letters', books: range('heb', 'jud') },
];

export const CATEGORIES = [
  { id: 'mine', label: 'My Plans' },
  { id: 'topic', label: 'Topics' },
  { id: 'book', label: 'Books' },
  { id: 'bible', label: 'Whole Bible' },
];

export const BUILTIN_PLANS = [
  // ---------------- Topics (original five keep their ids + day order) ----------------
  { id: 'peace', label: 'Peace & Anxiety', icon: 'leaf-outline', category: 'topic',
    description: 'Trade worry for the peace of God, one passage a day.',
    days: topical('php 4, isa 26, jhn 14, psa 23, mat 11, mat 6, isa 41') },
  { id: 'love', label: 'Love & Relationships', icon: 'heart-outline', category: 'topic',
    description: 'What real love looks like — patient, kind and faithful.',
    days: topical('1co 13, 1jn 4, eph 4, col 3, pro 17, jhn 15, rom 12, rut 1, eph 5, 1jn 3, gen 29, jhn 13, 1pe 4, rom 13') },
  { id: 'faith', label: 'Faith & Trust', icon: 'shield-checkmark-outline', category: 'topic',
    description: 'Grow a faith that holds when life shakes.',
    days: topical('heb 11, rom 8, psa 46, isa 41, mat 17, mrk 11, jas 1') },
  { id: 'healing', label: 'Healing & Strength', icon: 'medkit-outline', category: 'topic',
    description: 'Promises of restoration for body, mind and heart.',
    days: topical('isa 40, psa 103, jer 30, psa 147, isa 53, exo 15, psa 34, mat 9, jas 5, psa 41, pro 4, 3jn 1, psa 30, isa 57') },
  { id: 'purpose', label: 'Purpose & Guidance', icon: 'compass-outline', category: 'topic',
    description: '30 days on calling, direction and walking in God’s will.',
    days: topical('jer 29, pro 3, rom 12, psa 32, php 4, isa 30, eph 2, col 3, psa 25, pro 16, mat 6, rom 8, psa 119, isa 26, php 2, jhn 14, psa 37, pro 19, isa 40, jhn 15, psa 46, php 3, col 1, isa 55, psa 27, eph 4, jer 1, mat 11, psa 1, mic 6') },
  { id: 'prayer', label: 'A Life of Prayer', icon: 'hand-left-outline', category: 'topic',
    description: 'Learn to pray from Jesus, Paul, Daniel and the Psalms.',
    days: topical('mat 6, luk 11, luk 18, jhn 17, eph 3, php 4, col 1, jas 5, psa 145, dan 9') },
  { id: 'forgiveness', label: 'Forgiveness', icon: 'refresh-circle-outline', category: 'topic',
    description: 'Receive grace — and learn to give it away.',
    days: topical('psa 51, psa 32, luk 15, mat 18, eph 4, col 3, gen 50') },
  { id: 'hope', label: 'Hope Renewed', icon: 'sunny-outline', category: 'topic',
    description: 'An anchor for the soul when things feel dark.',
    days: topical('lam 3, psa 42, rom 5, rom 15, heb 6, 1pe 1, rev 21') },
  { id: 'fear', label: 'Overcoming Fear', icon: 'flame-outline', category: 'topic',
    description: '“Fear not” — courage rooted in God’s presence.',
    days: topical('jos 1, psa 27, psa 91, isa 41, isa 43, mat 14, 2ti 1') },
  { id: 'grief', label: 'Comfort in Grief', icon: 'rose-outline', category: 'topic',
    description: 'Gentle readings for seasons of loss and sorrow.',
    days: topical('psa 23, psa 34, jhn 11, 2co 1, 1th 4, isa 61, rev 21') },
  { id: 'gratitude', label: 'Gratitude & Praise', icon: 'happy-outline', category: 'topic',
    description: 'Seven days of thanksgiving that reshape the heart.',
    days: topical('psa 100, psa 103, psa 107, psa 136, luk 17, 1ch 16, col 2') },
  { id: 'identity', label: 'Who You Are in Christ', icon: 'finger-print-outline', category: 'topic',
    description: 'Chosen, loved, forgiven and made new.',
    days: topical('psa 139, eph 1, eph 2, 2co 5, gal 2, col 3, 1pe 2') },
  { id: 'wisdom', label: 'Wisdom for Decisions', icon: 'bulb-outline', category: 'topic',
    description: 'Ten days of practical wisdom for real choices.',
    days: topical('pro 1, pro 2, pro 3, pro 4, pro 8, pro 16, 1ki 3, jas 1, jas 3, ecc 12') },
  { id: 'spirit', label: 'The Holy Spirit', icon: 'flame', category: 'topic',
    description: 'Promised, poured out and living in every believer.',
    days: topical('ezk 36, jol 2, jhn 14, jhn 16, act 1, act 2, rom 8, 1co 12, gal 5, eph 1') },
  { id: 'marriage', label: 'Marriage & Family', icon: 'people-outline', category: 'topic',
    description: 'God’s design for covenant love and a godly home.',
    days: topical('gen 2, psa 127, pro 31, sng 2, mat 19, 1co 7, 1co 13, eph 5, col 3, 1pe 3') },
  { id: 'money', label: 'Money & Generosity', icon: 'wallet-outline', category: 'topic',
    description: 'Contentment, stewardship and cheerful giving.',
    days: topical('pro 3, mal 3, mat 6, luk 12, 2co 9, 1ti 6, php 4') },
  { id: 'leadership', label: 'Servant Leadership', icon: 'ribbon-outline', category: 'topic',
    description: 'Lead like Moses, Nehemiah and Jesus.',
    days: topical('exo 18, num 27, jos 1, 1sa 16, 1ki 3, neh 1, neh 2, neh 4, mrk 10, jhn 13, act 6, 1ti 3, tit 1, 1pe 5') },
  { id: 'heroes', label: 'Heroes of Faith', icon: 'trophy-outline', category: 'topic',
    description: 'Walk through Hebrews 11 and the stories behind it.',
    days: topical('heb 11, gen 6, gen 12, gen 22, exo 3, exo 14, jos 6, jdg 7, 1sa 17, dan 3, dan 6, est 4, act 7, 2ti 4') },
  { id: 'women', label: 'Women of the Bible', icon: 'flower-outline', category: 'topic',
    description: 'Sarah, Rahab, Deborah, Ruth, Hannah, Esther, Mary and more.',
    days: topical('gen 18, exo 2, jos 2, jdg 4, rut 1, rut 2, 1sa 1, est 4, pro 31, luk 1, luk 10, jhn 20') },
  { id: 'easter', label: 'The Cross & Resurrection', icon: 'add-circle-outline', category: 'topic',
    description: 'From prophecy to the empty tomb in ten days.',
    days: topical('isa 53, psa 22, mat 26, mat 27, jhn 19, mat 28, luk 24, jhn 20, 1co 15, rom 6') },
  { id: 'newbeliever', label: 'New Believer Foundations', icon: 'school-outline', category: 'topic',
    description: 'The essentials of the faith in two weeks.',
    days: topical('jhn 1, jhn 3, rom 3, rom 5, rom 6, rom 8, rom 10, eph 2, act 2, tit 3, gal 5, jas 1, 1jn 1, 1jn 5') },
  { id: 'comfortpsalms', label: 'Psalms of Comfort', icon: 'musical-notes-outline', category: 'topic',
    description: 'Fourteen psalms to pray when your soul is weary.',
    days: topical('psa 4, psa 16, psa 23, psa 27, psa 34, psa 37, psa 40, psa 46, psa 62, psa 91, psa 103, psa 121, psa 139, psa 145') },

  // ---------------- Books ----------------
  { id: 'john21', label: 'John in 21 Days', icon: 'book-outline', category: 'book',
    description: 'The Gospel of John, one chapter a day.',
    days: splitIntoDays(chaptersOf(['jhn']), 21) },
  { id: 'mark16', label: 'Mark in 16 Days', icon: 'walk-outline', category: 'book',
    description: 'The fast-moving Gospel of action.',
    days: splitIntoDays(chaptersOf(['mrk']), 16) },
  { id: 'proverbs31', label: 'Proverbs in a Month', icon: 'calendar-number-outline', category: 'book',
    description: 'One chapter of Proverbs for every day of the month.',
    days: splitIntoDays(chaptersOf(['pro']), 31) },
  { id: 'genesis25', label: 'Genesis in 25 Days', icon: 'planet-outline', category: 'book',
    description: 'Creation, the patriarchs and Joseph — two chapters a day.',
    days: splitIntoDays(chaptersOf(['gen']), 25) },
  { id: 'acts28', label: 'Acts in 28 Days', icon: 'boat-outline', category: 'book',
    description: 'The birth and spread of the early church.',
    days: splitIntoDays(chaptersOf(['act']), 28) },
  { id: 'romans16', label: 'Romans in 16 Days', icon: 'library-outline', category: 'book',
    description: 'Paul’s masterpiece on grace, faith and new life.',
    days: splitIntoDays(chaptersOf(['rom']), 16) },
  { id: 'gospels40', label: 'The Gospels in 40 Days', icon: 'sparkles-outline', category: 'book',
    description: 'Matthew, Mark, Luke and John — the life of Jesus.',
    days: splitIntoDays(chaptersOf(['mat', 'mrk', 'luk', 'jhn']), 40) },
  { id: 'paul30', label: "Paul's Letters in 30 Days", icon: 'mail-open-outline', category: 'book',
    description: 'Romans through Philemon in a month.',
    days: splitIntoDays(chaptersOf(range('rom', 'phm')), 30) },
  { id: 'psalms50', label: 'Psalms in 50 Days', icon: 'musical-note-outline', category: 'book',
    description: 'All 150 psalms, three a day.',
    days: splitIntoDays(chaptersOf(['psa']), 50) },

  // ---------------- Whole Bible ----------------
  { id: 'nt90', label: 'New Testament in 90 Days', icon: 'trending-up-outline', category: 'bible',
    description: 'All 260 chapters of the New Testament in three months.',
    days: splitIntoDays(chaptersOf(range('mat', 'rev')), 90) },
  { id: 'ot1y', label: 'Old Testament in a Year', icon: 'time-outline', category: 'bible',
    description: 'Genesis to Malachi at a steady pace.',
    days: splitIntoDays(chaptersOf(range('gen', 'mal')), 365) },
  { id: 'bible1y', label: 'Bible in a Year', icon: 'globe-outline', category: 'bible',
    description: 'Every chapter, Genesis to Revelation, in 365 days.',
    days: splitIntoDays(chaptersOf(BOOKS.map((b) => b.id)), 365) },
];

export const PLAN_ICONS = [
  'book-outline', 'heart-outline', 'leaf-outline', 'star-outline', 'sunny-outline',
  'flame-outline', 'compass-outline', 'school-outline', 'people-outline', 'sparkles-outline',
];
