import AsyncStorage from '@react-native-async-storage/async-storage';
import { BOOKS, getBookById } from './books';

// Static require map (see data/kjv/index.js) — Metro can't resolve dynamic
// require() paths, so every book has an explicit, lazily-invoked entry here.
// Only the book actually being read gets parsed into memory; the whole
// Bible is never loaded at once (loading all ~4.3MB synchronously at app
// startup was a real crash risk on some devices/builds).
const KJV_BOOK_LOADERS = require('./kjv/index.js');
const bookCache = {};

function loadKjvBook(bookId) {
  if (bookCache[bookId]) return bookCache[bookId];
  const loader = KJV_BOOK_LOADERS[bookId];
  if (!loader) return null;
  try {
    const data = loader();
    bookCache[bookId] = data;
    return data;
  } catch (e) {
    console.log(`[Bible] Failed to load bundled book "${bookId}":`, e?.message);
    return null;
  }
}

// Other translations are fetched from bible-api.com (free, no key required) the
// first time a passage is opened, then cached to AsyncStorage so every version
// works offline after that. This is what makes "switch version on any page or
// verse" possible without bundling several multi-megabyte translations.
const REMOTE_TRANSLATIONS = { web: 'web', asv: 'asv', bbe: 'bbe' };
const CACHE_PREFIX = 'bible_cache_v1_';

function resolveBook(bookIdOrName) {
  if (bookIdOrName && KJV_BOOK_LOADERS[String(bookIdOrName).toLowerCase()]) {
    return getBookById(bookIdOrName) || BOOKS.find(b => b.id === String(bookIdOrName).toLowerCase());
  }
  return getBookById(bookIdOrName);
}

async function getFromCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveToCache(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache is a nice-to-have; ignore write failures (e.g. storage full).
  }
}

async function fetchRemoteChapter(book, chapter, apiTranslation) {
  const cacheKey = `${CACHE_PREFIX}${apiTranslation}_${book.id}_${chapter}`;
  const cached = await getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://bible-api.com/${encodeURIComponent(book.name)}+${chapter}?translation=${apiTranslation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bible-api.com ${res.status}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.verses) || json.verses.length === 0) {
    throw new Error('Empty translation response');
  }

  const verses = {};
  json.verses.forEach(v => {
    verses[v.verse] = String(v.text || '').trim();
  });

  await saveToCache(cacheKey, verses);
  return verses;
}

/**
 * Get a chapter's verses as { [verseNumber]: text }.
 * `version` is one of: 'kjv' (default, bundled/offline), or 'web' | 'asv' | 'bbe'
 * (fetched from bible-api.com on first read, then cached offline).
 * Always resolves — falls back to the bundled KJV text if a remote translation
 * can't be reached, so reading never breaks when switching versions.
 */
export async function getChapter(bookIdOrName, chapter, version = 'kjv') {
  const book = resolveBook(bookIdOrName);
  if (!book) return {};

  const bookData = loadKjvBook(book.id);
  const kjvChapter = (bookData && bookData[chapter]) || {};
  const v = String(version || 'kjv').toLowerCase();

  if (v === 'kjv' || !REMOTE_TRANSLATIONS[v]) {
    return kjvChapter;
  }

  try {
    const remote = await fetchRemoteChapter(book, chapter, REMOTE_TRANSLATIONS[v]);
    return remote && Object.keys(remote).length ? remote : kjvChapter;
  } catch (e) {
    console.log(`[Bible] Falling back to KJV for ${book.name} ${chapter} (${v} unavailable):`, e.message);
    return kjvChapter;
  }
}

/**
 * Full-text verse search. Always searches the bundled KJV text (other
 * translations aren't indexed locally), which keeps search instant and
 * fully offline regardless of the reader's currently selected version.
 * Note: unlike getChapter, a broad search does need to load each book file
 * as it scans — that cost is paid only when the user actually searches, not
 * on every app launch.
 */
export async function searchVerses(query, version = 'kjv', limit = 20) {
  const q = String(query || '').toLowerCase().trim();
  if (q.length < 2) return [];

  const results = [];
  for (const book of BOOKS) {
    const chapters = loadKjvBook(book.id);
    if (!chapters) continue;
    for (const chNum of Object.keys(chapters)) {
      const verses = chapters[chNum];
      for (const vNum of Object.keys(verses)) {
        const text = verses[vNum];
        if (text.toLowerCase().includes(q)) {
          results.push({
            bookId: book.id,
            bookName: book.name,
            chapter: Number(chNum),
            verse: Number(vNum),
            text,
            ref: `${book.name} ${chNum}:${vNum}`,
          });
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}

/**
 * Deterministic day-based pseudo-random verse, rotating across the entire
 * Bible (not a small curated list) — same verse all day, a different one
 * (eventually covering the whole KJV) every day after. Uses a lightweight
 * multiplicative hash rather than a full verse manifest, so picking today's
 * verse only ever loads the one chapter it lands on, not the whole Bible.
 */
function hashInt(n, salt) {
  let h = (n ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

export async function getVerseOfTheDay(date = new Date()) {
  const dayIndex = Math.floor(date.getTime() / 86400000);

  for (let attempt = 0; attempt < 3; attempt++) {
    const salt = attempt * 10;
    const book = BOOKS[hashInt(dayIndex, salt + 1) % BOOKS.length];
    const chapterNum = (hashInt(dayIndex, salt + 2) % Math.max(book.chapters || 1, 1)) + 1;
    const chapterVerses = await getChapter(book.id, chapterNum, 'kjv');
    const verseNums = Object.keys(chapterVerses).map(Number).sort((a, b) => a - b);
    if (!verseNums.length) continue;
    const verseNum = verseNums[hashInt(dayIndex, salt + 3) % verseNums.length];
    const text = chapterVerses[verseNum];
    // Skip very short fragments (e.g. transitional half-verses) when we can,
    // for a more useful "verse of the day" — but not at the cost of failing
    // entirely if the Bible just doesn't have a longer one on this attempt.
    if (text && text.length >= 25) {
      return { bookId: book.id, bookName: book.name, chapter: chapterNum, verse: verseNum, text, ref: `${book.name} ${chapterNum}:${verseNum}` };
    }
    if (attempt === 2 && text) {
      return { bookId: book.id, bookName: book.name, chapter: chapterNum, verse: verseNum, text, ref: `${book.name} ${chapterNum}:${verseNum}` };
    }
  }
  // Should be unreachable given a valid bundled Bible, but keep the app
  // usable even if something upstream is wrong.
  return { bookId: 'psa', bookName: 'Psalms', chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.', ref: 'Psalm 23:1' };
}

