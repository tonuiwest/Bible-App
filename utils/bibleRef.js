import { BOOKS } from '../data/books';

// Alias -> book id. Covers full names, common abbreviations, singular
// "Psalm", "Revelations", and ordinal words ("first john", "1st john", "i john").
const EXTRA_ALIASES = {
  gen: ['gen', 'gn'], exo: ['exodus', 'exo', 'ex', 'exod'], lev: ['lev', 'lv'], num: ['num', 'nm', 'numb'],
  deu: ['deut', 'dt', 'deu'], jos: ['josh', 'jos'], jdg: ['judg', 'jdg', 'jgs'], rut: ['ru', 'rth'],
  '1sa': ['1 sam', '1sam', '1 sa'], '2sa': ['2 sam', '2sam', '2 sa'], '1ki': ['1 kgs', '1 kings', '1kgs', '1 ki'], '2ki': ['2 kgs', '2kgs', '2 ki'],
  '1ch': ['1 chron', '1 chr', '1chr'], '2ch': ['2 chron', '2 chr', '2chr'], ezr: ['ezr'], neh: ['neh'], est: ['esth', 'est'],
  psa: ['psalm', 'psalms', 'ps', 'psa', 'pss'], pro: ['prov', 'pr', 'prv', 'pro'], ecc: ['eccl', 'eccles', 'ecc', 'qoheleth'],
  sng: ['song of songs', 'song', 'songs', 'sos', 'canticles', 'song of solomon'], isa: ['isa', 'is'], jer: ['jer', 'jr'],
  lam: ['lam'], ezk: ['ezek', 'eze', 'ezk'], dan: ['dan', 'dn'], hos: ['hos'], jol: ['joel', 'jl'], amo: ['amos', 'am'],
  oba: ['obad', 'ob'], jon: ['jonah', 'jon'], mic: ['mic', 'mi'], nah: ['nah', 'na'], hab: ['hab'], zep: ['zeph', 'zep'],
  hag: ['hag'], zec: ['zech', 'zec'], mal: ['mal'], mat: ['matt', 'mt', 'mat'], mrk: ['mk', 'mrk', 'mar'], luk: ['lk', 'luk'],
  jhn: ['jn', 'jhn', 'joh'], act: ['acts', 'act', 'ac'], rom: ['rom', 'rm'], '1co': ['1 cor', '1cor', '1 co'], '2co': ['2 cor', '2cor', '2 co'],
  gal: ['gal'], eph: ['eph'], php: ['phil', 'php', 'philip'], col: ['col'], '1th': ['1 thess', '1 thes', '1 th', '1thess'],
  '2th': ['2 thess', '2 thes', '2 th', '2thess'], '1ti': ['1 tim', '1tim', '1 ti'], '2ti': ['2 tim', '2tim', '2 ti'], tit: ['tit'],
  phm: ['philem', 'phlm', 'phm'], heb: ['heb'], jas: ['jas', 'jm', 'jam'], '1pe': ['1 pet', '1pet', '1 pe', '1 pt'], '2pe': ['2 pet', '2pet', '2 pe', '2 pt'],
  '1jn': ['1 jn', '1 john', '1jn', '1 jo'], '2jn': ['2 jn', '2jn'], '3jn': ['3 jn', '3jn'], jud: ['jude', 'jud'], rev: ['rev', 'revelations', 'rv', 'apocalypse'],
};

const NUMBERED = '(?=(john|jn|peter|pet|pe|corinthians|cor|kings|kgs|samuel|sam|chronicles|chron|chr|thessalonians|thess|thes|timothy|tim)\\b)';
const ORDINALS = [
  [new RegExp('\\b(first|1st|i)\\s+' + NUMBERED, 'gi'), '1 '],
  [new RegExp('\\b(second|2nd|ii)\\s+' + NUMBERED, 'gi'), '2 '],
  [new RegExp('\\b(third|3rd|iii)\\s+' + NUMBERED, 'gi'), '3 '],
];

const ALIAS_TO_ID = (() => {
  const map = {};
  BOOKS.forEach((b) => { map[b.name.toLowerCase()] = b.id; map[b.id] = b.id; });
  Object.entries(EXTRA_ALIASES).forEach(([id, list]) => list.forEach((a) => { map[a] = id; }));
  return map;
})();

// Longest aliases first so "1 john" wins over "john", "song of solomon" over "song".
const ALIASES_SORTED = Object.keys(ALIAS_TO_ID).sort((a, b) => b.length - a.length);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALIAS_RE = ALIASES_SORTED.map(escapeRe).join('|');

// <book> <chapter>[:<verse>[-<verse>]]   (also accepts "." as separator)
const REF_RE = new RegExp(`\\b(${ALIAS_RE})\\.?\\s*(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?\\b`, 'gi');

function normalizeOrdinals(text) {
  let t = String(text || '');
  ORDINALS.forEach(([re, rep]) => { t = t.replace(re, rep); });
  return t;
}

export function bookIdFromAlias(alias) {
  return ALIAS_TO_ID[String(alias || '').toLowerCase().replace(/\s+/g, ' ').trim()] || null;
}

export function bookName(id) {
  return BOOKS.find((b) => b.id === id)?.name || id;
}

/** Canonical string, e.g. "John 3:16", "Psalms 23", "1 Corinthians 13:4-7". */
export function formatRef({ bookId, chapter, vStart, vEnd }) {
  // "Psalm 23", not "Psalms 23", when citing a single psalm.
  const n = bookId === 'psa' ? 'Psalm' : bookName(bookId);
  if (!vStart) return `${n} ${chapter}`;
  if (vEnd && vEnd !== vStart) return `${n} ${chapter}:${vStart}-${vEnd}`;
  return `${n} ${chapter}:${vStart}`;
}

/** Finds every Scripture reference in free text. Invalid chapters are dropped. */
export function findReferences(text) {
  const t = normalizeOrdinals(text);
  const out = [];
  let m;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(t))) {
    const skip = () => { REF_RE.lastIndex = m.index + 1; };
    const id = bookIdFromAlias(m[1]);
    if (!id) { skip(); continue; }
    const book = BOOKS.find((b) => b.id === id);
    const chapter = parseInt(m[2], 10);
    if (!book || chapter < 1 || chapter > book.chapters) { skip(); continue; }
    // Guard against everyday words that happen to be abbreviations ("is 3", "am 5").
    const raw = m[1].toLowerCase();
    if (['is', 'am', 'ac', 'na', 'mi', 'ex', 'song', 'act', 'mar', 'jam', 'num', 'ob'].includes(raw) && !m[3]) { skip(); continue; }
    const vStart = m[3] ? parseInt(m[3], 10) : null;
    let vEnd = m[4] ? parseInt(m[4], 10) : vStart;
    if (vStart && vEnd < vStart) vEnd = vStart;
    out.push({ bookId: id, chapter, vStart, vEnd, ref: formatRef({ bookId: id, chapter, vStart, vEnd }) });
  }
  return out;
}

export function parseReference(text) {
  return findReferences(text)[0] || null;
}

// Book names that are also everyday words or common personal names; only
// treated as a *book* when the question clearly asks about a book.
const AMBIGUOUS_BOOKS = new Set(['job', 'acts', 'numbers', 'judges', 'mark', 'john', 'ruth', 'esther', 'daniel', 'jonah', 'james', 'jude', 'kings', 'song', 'revelation', 'joel', 'amos', 'luke', 'matthew', 'titus', 'philemon', 'micah', 'samuel', 'joshua', 'nehemiah', 'ezra', 'isaiah', 'jeremiah', 'ezekiel', 'hosea', 'obadiah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi', 'timothy', 'peter']);

/**
 * Finds a book mentioned by name (no chapter). Returns { bookId, explicit }
 * where explicit = the text says "book of X" / "X book".
 */
export function findBookMention(text) {
  const t = normalizeOrdinals(text).toLowerCase();
  for (const alias of ALIASES_SORTED) {
    if (alias.length < 3) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(alias)}([^a-z]|$)`, 'i');
    if (!re.test(t)) continue;
    const id = ALIAS_TO_ID[alias];
    const explicit = new RegExp(`(book of|books of|the book)\\s+(the\\s+)?${escapeRe(alias)}|${escapeRe(alias)}\\s+book`, 'i').test(t)
      || new RegExp(`(gospel of|epistle of|letter of|letter to (the )?)\\s*${escapeRe(alias)}`, 'i').test(t);
    return { bookId: id, alias, explicit, ambiguous: AMBIGUOUS_BOOKS.has(alias) };
  }
  return null;
}
