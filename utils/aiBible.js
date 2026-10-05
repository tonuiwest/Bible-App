/*
 * Bible AI engine (offline).
 *
 * Every answer is assembled from a curated knowledge base (books, people,
 * topics, FAQs, verse commentary, glossary, illustrations) and grounded in
 * the actual Scripture text pulled from the bundled KJV at answer time — so
 * every quoted verse is real and correctly referenced, and nothing depends
 * on a network connection or API key.
 *
 * Output shape (rendered by components/AIAnswer.js):
 *   { kind, title, lead, sections: [{ heading, icon, body, bullets, verses }],
 *     followUps: string[], refs: string[] }
 */
import { getChapter, searchVerses } from '../data/bibleData';
import { BOOKS } from '../data/books';
import { findReferences, findBookMention, formatRef, bookName } from './bibleRef';
import { BOOK_INFO } from '../ai/knowledge/books';
import { PEOPLE } from '../ai/knowledge/people';
import { TOPICS } from '../ai/knowledge/topics';
import { FAQ } from '../ai/knowledge/faq';
import { VERSE_NOTES } from '../ai/knowledge/verseNotes';
import { GLOSSARY } from '../ai/knowledge/glossary';
import { ILLUSTRATIONS } from '../ai/knowledge/illustrations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(('what does the bible say about how can should with from that this have when where why who which into over your their his her ' +
  'and for are was were will would could not but all any some than then there here out just like get got feel feeling feels been being tell know ' +
  'about me my you i a an of in on to is it do am im ive dont cant help please explain meaning mean means verse verses scripture scriptures ' +
  'god jesus lord christ christian christians bible teach teaches teaching does say said says talk talks give gives show find want need ' +
  'really much many very thing things way something someone anyone people person really also deal keep keeps kept make makes made take takes ' +
  'going come comes put let try trying stop start use think thought said saying doing done did has had lot always never still even every ' +
  'today now time times day days life ever ok okay yes well good bad right wrong sure maybe').split(/\s+/));

// Everyday words -> the word the KJV actually uses, for better search hits.
const SYNONYMS = {
  coworker: 'neighbour', colleague: 'neighbour', neighbor: 'neighbour', boss: 'master', employer: 'master', lying: 'lie', liar: 'lie',
  lied: 'lie', kids: 'children', kid: 'child', mom: 'mother', mum: 'mother', dad: 'father', worry: 'careful', stressed: 'trouble',
  stress: 'trouble', depressed: 'heaviness', scared: 'afraid', money: 'money', job: 'labour', work: 'labour', happy: 'joy',
  sad: 'sorrow', sick: 'sick', forgive: 'forgive', honor: 'honour', favor: 'favour', savior: 'saviour',
};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const pick = (arr, seed) => arr[seed % arr.length];

function keywordsOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/)
    .map((w) => w.replace(/'s$/, '').replace(/'/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map((w) => SYNONYMS[w] || w);
}

const hasWord = (text, word) => new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(text);

const topicById = (id) => TOPICS.find((t) => t.id === id);

// Psalm superscriptions ("[A Psalm of David.]") and Psalm 119's Hebrew
// letter headings ("NUN.") are part of the printed text but read oddly when
// quoted inline in an answer.
const cleanVerse = (t) => String(t || '').replace(/^\[[^\]]*\]\s*/, '').replace(/^[A-Z]{2,}\.\s+/, '').trim();

/** Fetches the KJV text for "John 3:16", "Psalms 23:1-6" or "Psalms 23". */
export async function fetchPassage(refStr, { maxVerses = 8 } = {}) {
  const parsed = typeof refStr === 'string' ? findReferences(refStr)[0] : refStr;
  if (!parsed) return null;
  try {
    const ch = await getChapter(parsed.bookId, parsed.chapter, 'kjv');
    const nums = Object.keys(ch).map(Number).sort((a, b) => a - b);
    if (!nums.length) return null;
    let from = parsed.vStart || nums[0];
    let to = parsed.vStart ? (parsed.vEnd || parsed.vStart) : Math.min(nums[nums.length - 1], nums[0] + maxVerses - 1);
    to = Math.min(to, from + 30);
    const parts = [];
    for (let v = from; v <= to; v++) if (ch[v]) parts.push(cleanVerse(ch[v]));
    if (!parts.length) return null;
    const truncated = !parsed.vStart && nums.length > maxVerses;
    return {
      ref: parsed.vStart ? formatRef(parsed) : `${formatRef({ ...parsed, vStart: from, vEnd: to })}`,
      text: parts.join(' ') + (truncated ? ' …' : ''),
      bookId: parsed.bookId, chapter: parsed.chapter, verse: from,
    };
  } catch {
    return null;
  }
}

async function fetchMany(refs, opts) {
  const out = await Promise.all((refs || []).map((r) => fetchPassage(r, opts)));
  return out.filter(Boolean);
}

function scoreTopics(text) {
  const lower = String(text || '').toLowerCase();
  const scores = [];
  for (const t of TOPICS) {
    let score = 0;
    for (const kw of t.keywords) {
      if (kw.includes(' ') ? lower.includes(kw) : hasWord(lower, kw)) score += kw.includes(' ') ? 3 : 2;
    }
    const labelWord = t.label.toLowerCase().split(/[\s&]+/).find((w) => w.length >= 4 && !['the', 'our', 'being', 'with', 'your'].includes(w));
    if (labelWord && hasWord(lower, labelWord)) score += 1;
    if (score > 0) scores.push({ topic: t, score });
  }
  return scores.sort((a, b) => b.score - a.score);
}

function glossaryFor(text, limit = 3) {
  const found = [];
  for (const g of GLOSSARY) {
    const hit = g.match.some((m) => {
      if (g.caseSensitive) return new RegExp(`(^|[^A-Za-z])${m}([^A-Za-z]|$)`).test(text);
      return hasWord(text, m);
    });
    if (hit) found.push(g);
    if (found.length >= limit) break;
  }
  return found;
}

function sectionOf(bookId, chapter) {
  const info = BOOK_INFO[bookId];
  if (!info) return null;
  const s = info.outline.find(([a, b]) => chapter >= a && chapter <= b);
  return s ? s[2] : null;
}

function noteFor(parsed) {
  const keys = [];
  const name = bookName(parsed.bookId);
  if (parsed.vStart) {
    keys.push(`${name} ${parsed.chapter}:${parsed.vStart}${parsed.vEnd && parsed.vEnd !== parsed.vStart ? '-' + parsed.vEnd : ''}`);
    keys.push(`${name} ${parsed.chapter}:${parsed.vStart}`);
    // Any note whose range contains this verse.
    Object.keys(VERSE_NOTES).forEach((k) => {
      const m = k.match(/^(.*) (\d+):(\d+)-(\d+)$/);
      if (m && m[1] === name && +m[2] === parsed.chapter && parsed.vStart >= +m[3] && parsed.vStart <= +m[4]) keys.push(k);
    });
  } else {
    keys.push(`${name} ${parsed.chapter}`);
  }
  for (const k of keys) if (VERSE_NOTES[k]) return { key: k, ...VERSE_NOTES[k] };
  return null;
}

function authorPhrase(info) {
  const a = info.author;
  if (/^Unknown/.test(a)) {
    const extra = a.replace(/^Unknown\s*/, '').replace(/^\((.*)\)$/, '$1');
    return `by an unknown author${extra ? ` (${extra})` : ''}`;
  }
  if (/^(Mainly|The|John|“)/.test(a) && /^(Mainly|The)/.test(a)) return `by ${a.charAt(0).toLowerCase() + a.slice(1)}`;
  return `by ${a}`;
}

function bookIntroLine(bookId) {
  const info = BOOK_INFO[bookId];
  if (!info) return '';
  const first = info.audience.split(' ')[0];
  const lowerFirst = ['The', 'All', 'Believers', 'Young', 'Primarily', 'Gentile', 'Churches', 'Seekers', 'Survivors', 'Exiles', 'Prosperous', 'Northern', 'Post-exilic', 'Jewish', 'Jews'].includes(first);
  const aud = lowerFirst ? info.audience.charAt(0).toLowerCase() + info.audience.slice(1) : info.audience;
  const when = info.date.startsWith('c.') ? 'around ' + info.date.slice(3) : info.date.charAt(0).toLowerCase() + info.date.slice(1);
  return `${bookName(bookId)} (${info.genre}) was written ${authorPhrase(info)}, ${when}, for ${aud}. Its theme: ${info.theme}`;
}

const GENRE_APPLY = {
  'Law (Torah)': 'Ask what this passage reveals about God’s character and His covenant love — then how Jesus fulfils it for you.',
  History: 'Look for how God works through real people’s choices; ask which response you need to imitate or avoid.',
  Wisdom: 'Wisdom literature is meant to be lived: pick one line and practise it today.',
  'Poetry / Worship': 'Pray these words back to God in your own situation — the psalms were written to be prayed.',
  Poetry: 'Read it slowly and let the imagery shape how you see God’s love.',
  'Poetry / Lament': 'Bring your honest sorrow to God as the writer did, and hold on to His faithfulness.',
  'Major Prophet': 'Prophets call God’s people back to Him: what is God calling you to turn from or toward?',
  'Minor Prophet': 'Notice both the warning and the promise; respond to God’s call with repentance and hope.',
  'Prophecy / Apocalyptic': 'Apocalyptic writing reminds us God rules history — let it steady your faith today.',
  Gospel: 'Watch what Jesus says and does here, and ask: what does this show me about Him, and how do I follow?',
  'Epistle (Paul)': 'These letters applied the gospel to real churches. Identify the instruction and how it flows from what Christ has done.',
  Epistle: 'Identify the command or encouragement and the reason given for it.',
  'Pastoral Epistle': 'Written to guide church leaders; consider how it shapes your faithfulness and community.',
};

function reflectionQuestions(info, verseText, seed) {
  const pool = [
    'What does this passage reveal about God’s character?',
    'Is there a promise here to hold onto, or a command to obey?',
    'Which word or phrase stands out to you most, and why?',
    'How would your week look different if you lived this out?',
    'What does this passage show you about Jesus?',
    'Is there something here to thank God for in prayer?',
  ];
  const qs = [];
  for (let i = 0; i < 3; i++) qs.push(pool[(seed + i * 2) % pool.length]);
  return qs;
}

function uniqueByRef(list) {
  const seen = new Set();
  return list.filter((v) => (seen.has(v.ref) ? false : (seen.add(v.ref), true)));
}

/** Multi-keyword search: verses containing more of the words rank higher. */
async function rankedSearch(words, { limit = 5, exclude = [] } = {}) {
  const kws = Array.from(new Set(words)).slice(0, 4);
  if (!kws.length) return [];
  const pool = new Map();
  for (const kw of kws) {
    const hits = await searchVerses(kw, 'kjv', 400);
    for (const h of hits) {
      const key = h.ref;
      if (exclude.includes(key)) continue;
      const entry = pool.get(key) || { ...h, score: 0 };
      entry.score += 1;
      pool.set(key, entry);
    }
  }
  const lowerKws = kws.map((k) => k.toLowerCase());
  const ranked = Array.from(pool.values()).map((v) => {
    const t = v.text.toLowerCase();
    const whole = lowerKws.filter((k) => hasWord(t, k)).length; // whole-word bonus
    return { ...v, score: v.score * 2 + whole + (v.text.length < 220 ? 0.5 : 0) };
  }).sort((a, b) => b.score - a.score);
  // Spread across books so one book doesn't dominate.
  const out = [];
  const perBook = {};
  for (const v of ranked) {
    if ((perBook[v.bookId] || 0) >= 2) continue;
    perBook[v.bookId] = (perBook[v.bookId] || 0) + 1;
    out.push({ ref: v.ref, text: v.text, bookId: v.bookId, chapter: v.chapter, verse: v.verse });
    if (out.length >= limit) break;
  }
  return out;
}

export function toPlainText(res) {
  if (!res) return '';
  const lines = [res.title, ''];
  if (res.lead) lines.push(res.lead, '');
  (res.sections || []).forEach((s) => {
    if (s.heading) lines.push(s.heading.toUpperCase());
    if (s.body) lines.push(s.body);
    (s.bullets || []).forEach((b) => lines.push(`• ${b}`));
    (s.verses || []).forEach((v) => lines.push(`“${v.text}” — ${v.ref}`));
    lines.push('');
  });
  return lines.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Answer builders
// ---------------------------------------------------------------------------

async function answerPassage(parsed, q) {
  const info = BOOK_INFO[parsed.bookId];
  const name = bookName(parsed.bookId);
  const note = noteFor(parsed);
  const seed = hash(q);
  const sections = [];
  const isChapter = !parsed.vStart;

  const main = await fetchPassage(parsed, { maxVerses: isChapter ? 6 : 20 });
  if (!main) {
    return answerFallback(q);
  }

  // Surrounding context for a single verse or short range.
  let contextVerses = [];
  if (!isChapter) {
    const ch = await getChapter(parsed.bookId, parsed.chapter, 'kjv');
    const before = [parsed.vStart - 2, parsed.vStart - 1].filter((n) => ch[n]);
    const after = [(parsed.vEnd || parsed.vStart) + 1, (parsed.vEnd || parsed.vStart) + 2].filter((n) => ch[n]);
    if (before.length) contextVerses.push({ ref: `${name} ${parsed.chapter}:${before[0]}${before.length > 1 ? '-' + before[before.length - 1] : ''}`, text: before.map((n) => cleanVerse(ch[n])).join(' '), bookId: parsed.bookId, chapter: parsed.chapter, verse: before[0] });
    if (after.length) contextVerses.push({ ref: `${name} ${parsed.chapter}:${after[0]}${after.length > 1 ? '-' + after[after.length - 1] : ''}`, text: after.map((n) => cleanVerse(ch[n])).join(' '), bookId: parsed.bookId, chapter: parsed.chapter, verse: after[0] });
  }

  sections.push({ heading: isChapter ? (main.text.endsWith('…') ? `${formatRef(parsed)} — opening verses` : `${formatRef(parsed)} — the full text`) : 'The passage', icon: 'book', verses: [main] });

  if (note) {
    sections.push({ heading: 'What it means', icon: 'bulb', body: note.meaning });
    sections.push({ heading: 'Context', icon: 'map', body: note.context + (info ? `\n\n${bookIntroLine(parsed.bookId)}` : '') });
  } else {
    const section = sectionOf(parsed.bookId, parsed.chapter);
    const glossary = glossaryFor(main.text, 3);
    const opener = pick([
      `This ${isChapter ? 'chapter' : 'passage'} comes from ${name} ${parsed.chapter}${section ? `, in the part of the book about “${section.toLowerCase()}”` : ''}.`,
      `${name} ${parsed.chapter} sits${section ? ` within the section on ${section.toLowerCase()}` : ` in the book of ${name}`}.`,
    ], seed);
    let body = opener;
    if (info) body += ` ${info.summary.split('. ').slice(0, 1).join('. ')}.`;
    if (contextVerses.length) body += ' Reading the verses around it (below) helps keep it in context — a verse means what it meant in its setting before it is applied to us.';
    sections.push({ heading: 'Context', icon: 'map', body, verses: contextVerses });
    if (glossary.length) {
      sections.push({ heading: 'Key words', icon: 'key', bullets: glossary.map((g) => `${g.term} — ${g.def}`) });
    }
    if (info) {
      sections.push({ heading: 'About the book', icon: 'library', body: bookIntroLine(parsed.bookId) });
    }
  }
  if (note && contextVerses.length) {
    sections.push({ heading: 'Surrounding verses', icon: 'reader', verses: contextVerses });
  }

  // Cross references: topics the passage speaks to.
  const citing = TOPICS.filter((t) => t.points.some((p) => p.refs.some((r) => {
    const pr = findReferences(r)[0];
    return pr && pr.bookId === parsed.bookId && pr.chapter === parsed.chapter && (!parsed.vStart || (pr.vStart <= parsed.vStart && (pr.vEnd || pr.vStart) >= parsed.vStart));
  })));
  const topicHits = [...citing, ...scoreTopics(main.text).map((s) => s.topic)].filter((t, i, a) => a.indexOf(t) === i).slice(0, 2);
  const crossRefs = [];
  // Refs from the exact teaching points that cite this passage come first.
  pointsCiting(parsed.bookId, parsed.chapter, parsed.vStart || 1, parsed.vEnd || parsed.vStart || 200)
    .forEach(({ point }) => point.refs.forEach((r) => crossRefs.push(r)));
  topicHits.forEach((t) => t.points.forEach((p) => p.refs.forEach((r) => crossRefs.push(r))));
  const crossVerses = uniqueByRef(await fetchMany(Array.from(new Set(crossRefs)).filter((r) => !r.startsWith(`${name} ${parsed.chapter}:`)).slice(0, 3)));
  if (crossVerses.length) {
    sections.push({ heading: 'Related Scripture', icon: 'link', verses: crossVerses });
  }

  const apply = note?.apply || (info && GENRE_APPLY[info.genre]) || 'Read it slowly, ask what it shows you about God, and respond in prayer.';
  sections.push({ heading: 'Living it out', icon: 'walk', body: apply, bullets: reflectionQuestions(info, main.text, seed) });

  if (info?.christ) {
    sections.push({ heading: 'Where Jesus is seen', icon: 'heart', body: info.christ });
  }

  const followUps = [
    isChapter ? `What is ${name} about?` : `Explain ${name} ${parsed.chapter}`,
    `Who wrote ${name}?`,
    topicHits[0] ? `What does the Bible say about ${topicHits[0].label.toLowerCase()}?` : `Write a sermon on ${main.ref}`,
  ];

  return {
    kind: 'passage',
    title: isChapter ? `${formatRef(parsed)} — overview` : `${parsed.ref} explained`,
    lead: pick([
      `Here’s what ${parsed.ref} says, the setting it was written in, and how it applies today.`,
      `Let’s look at ${parsed.ref} in its context — what it meant then and what it means for you now.`,
      `${parsed.ref} is best understood in its setting. Here’s the passage, its meaning and how to live it out.`,
    ], seed),
    sections,
    followUps,
    refs: [main.ref, ...crossVerses.map((v) => v.ref)],
  };
}

async function answerBook(bookId, q) {
  const info = BOOK_INFO[bookId];
  const name = bookName(bookId);
  const book = BOOKS.find((b) => b.id === bookId);
  if (!info) return answerFallback(q);
  const askedAuthor = /who wrote|author|written by/i.test(q);
  const askedDate = /when was .* written|date|how old/i.test(q);
  const sections = [];
  sections.push({ heading: 'At a glance', icon: 'information-circle', bullets: [
    `Author: ${info.author}`, `Written: ${info.date}`, `First readers: ${info.audience}`,
    `Type: ${info.genre}`, `Length: ${book.chapters} chapter${book.chapters > 1 ? 's' : ''} · ${book.num <= 39 ? 'Old' : 'New'} Testament (book ${book.num} of 66)`,
  ] });
  sections.push({ heading: 'What it’s about', icon: 'book', body: info.summary });
  sections.push({ heading: 'Outline', icon: 'list', bullets: info.outline.map(([a, b, t]) => (a === b ? `Chapter ${a}: ${t}` : `Chapters ${a}–${b}: ${t}`)) });
  const keyVerses = await fetchMany(info.keyVerses);
  if (keyVerses.length) sections.push({ heading: 'Key verses', icon: 'star', verses: keyVerses });
  sections.push({ heading: 'Where Jesus is seen', icon: 'heart', body: info.christ });

  let lead = `${name}: ${info.theme}`;
  if (askedAuthor) lead = `${name} was written ${authorPhrase(info)}${info.date.startsWith('c.') ? `, around ${info.date.slice(3)}` : ''}. ${info.theme}`;
  else if (askedDate) lead = `${name} is dated ${info.date}. ${info.theme}`;

  return {
    kind: 'book', title: `The Book of ${name}`, lead, sections,
    followUps: [`Explain ${name} 1`, `Explain ${info.keyVerses[0]}`, info.keyVerses[1] ? `Explain ${info.keyVerses[1]}` : `Who wrote ${name}?`],
    refs: keyVerses.map((v) => v.ref),
  };
}

async function answerPerson(person, q) {
  const sections = [];
  const sentences = person.summary.replace(/\.\s+/g, '.\u0000').split('\u0000');
  sections.push({ heading: 'Who they were', icon: 'person', body: sentences.slice(1).join(' ') || person.summary });
  sections.push({ heading: 'Key moments', icon: 'time', bullets: person.events.map(([t, r]) => `${t} — ${r}`) });
  const eventVerses = await fetchMany(person.events.slice(0, 3).map(([, r]) => r), { maxVerses: 3 });
  if (eventVerses.length) sections.push({ heading: 'In their story', icon: 'book', verses: eventVerses.map((v) => ({ ...v, text: v.text.length > 360 ? v.text.slice(0, 357).replace(/\s+\S*$/, '') + '…' : v.text })) });
  sections.push({ heading: 'Lessons for today', icon: 'bulb', bullets: person.lessons });
  const kv = await fetchMany(person.keyVerses);
  if (kv.length) sections.push({ heading: 'Key verses', icon: 'star', verses: kv });
  const others = PEOPLE.filter((p) => p.id !== person.id);
  const seed = hash(q);
  return {
    kind: 'person', title: person.name, lead: person.summary.split('. ')[0] + '.', sections,
    followUps: [`What can we learn from ${person.name.replace(/^The /, '')}?`, `Who was ${pick(others, seed).name.replace(/^The /, '')}?`, `Write a sermon on ${person.keyVerses[0]}`],
    refs: kv.map((v) => v.ref),
  };
}

async function answerFaq(item, q) {
  const verses = await fetchMany(item.refs);
  return {
    kind: 'faq', title: item.title, lead: item.answer.split('\n')[0],
    sections: [
      ...(item.answer.includes('\n') ? [{ heading: 'In more detail', icon: 'reader', body: item.answer.split('\n').slice(1).join('\n').trim() }] : []),
      { heading: 'Scripture', icon: 'book', verses },
    ],
    followUps: ['How can I be saved?', 'What is the gospel?', 'Who wrote the Bible?'].filter((f) => f.toLowerCase() !== item.title.toLowerCase()),
    refs: verses.map((v) => v.ref),
  };
}

async function answerTopic(topic, q, secondary) {
  const seed = hash(q);
  const sections = [];
  for (const p of topic.points) {
    const verses = await fetchMany(p.refs.slice(0, 3));
    sections.push({ heading: p.title, icon: 'bookmark', body: p.text, verses });
  }
  // Extra verses from the person's own words.
  const used = topic.points.flatMap((p) => p.refs);
  const extra = await rankedSearch(keywordsOf(q).filter((w) => !topic.keywords.includes(w)).concat(topic.keywords.slice(0, 1)), { limit: 2, exclude: used });
  if (extra.length) sections.push({ heading: 'More Scripture on this', icon: 'search', verses: extra });
  sections.push({ heading: 'Putting it into practice', icon: 'checkmark-done', bullets: topic.practice });
  if (secondary) {
    sections.push({ heading: `Related: ${secondary.label}`, icon: 'link', body: secondary.overview });
  }
  sections.push({ heading: 'A prayer', icon: 'hand-left', body: topic.prayer });

  const leads = [
    topic.overview,
    `${topic.overview}`,
  ];
  const related = (topic.related || []).map(topicById).filter(Boolean);
  return {
    kind: 'topic', title: `What the Bible says about ${topic.label.toLowerCase()}`, lead: pick(leads, seed), sections,
    followUps: [
      ...related.slice(0, 2).map((t) => `What does the Bible say about ${t.label.toLowerCase()}?`),
      `Write a sermon on ${topic.label.toLowerCase()}`,
    ],
    refs: sections.flatMap((s) => (s.verses || []).map((v) => v.ref)),
  };
}

async function answerFallback(q) {
  const words = keywordsOf(q);
  const verses = await rankedSearch(words, { limit: 6 });
  const gloss = GLOSSARY.filter((g) => words.some((w) => g.term.toLowerCase() === w || g.match.some((m) => m.toLowerCase() === w)));
  const sections = [];
  if (gloss.length) sections.push({ heading: 'Key idea', icon: 'key', bullets: gloss.slice(0, 2).map((g) => `${g.term} — ${g.def}`) });
  if (verses.length) {
    sections.push({ heading: 'What Scripture says', icon: 'book', verses });
    const topBook = BOOK_INFO[verses[0].bookId];
    if (topBook) sections.push({ heading: `About ${bookName(verses[0].bookId)}`, icon: 'library', body: bookIntroLine(verses[0].bookId) });
    sections.push({ heading: 'Going deeper', icon: 'walk', bullets: [
      'Open each verse in the reader and read the whole paragraph around it.',
      'Ask what each passage shows about God before asking what it asks of you.',
      'Try rephrasing your question with a topic (e.g. “forgiveness”, “anxiety”) or a reference (e.g. “Romans 8:28”).',
    ] });
  } else {
    const fallback = await fetchMany(['Psalms 119:105', 'Proverbs 3:5-6', 'James 1:5']);
    sections.push({ heading: 'A place to start', icon: 'book', body: 'I couldn’t find verses that use those exact words. Here are passages about seeking God’s guidance — and you can try asking with a topic (like “hope”) or a reference (like “John 14”).', verses: fallback });
  }
  return {
    kind: 'search',
    title: words.length ? `Scripture on “${words.slice(0, 3).join(' ')}”` : 'Let’s look at Scripture',
    lead: verses.length
      ? `I searched the whole Bible for the key words in your question. These passages speak most directly to it.`
      : 'Here are a few passages to begin with.',
    sections,
    followUps: ['What does the Bible say about hope?', 'Explain John 3:16', 'What is the gospel?'],
    refs: verses.map((v) => v.ref),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const CRISIS_RE = /(kill myself|end my life|take my (own )?life|suicid|want to die|don'?t want to (live|be alive)|self[- ]?harm|cut myself|hurt myself|no reason to live|better off dead)/i;

async function answerCrisis() {
  const verses = await fetchMany(['Psalms 34:18', 'Matthew 11:28', 'Isaiah 41:10']);
  return {
    kind: 'crisis',
    title: 'You matter — please reach out now',
    lead: 'I’m really glad you said something. What you’re feeling is serious, and you deserve real support from a person right now, not just words on a screen.',
    sections: [
      { heading: 'Please talk to someone today', icon: 'call', bullets: [
        'If you might act on these thoughts or are in danger, call your local emergency number now.',
        'Contact a crisis line — in the US call or text 988; in other countries find a free, confidential line at findahelpline.com.',
        'Tell someone you trust — a friend, family member, pastor or doctor — what you told me here.',
        'If you can, don’t stay alone right now; move to where other people are.',
      ] },
      { heading: 'God has not left you', icon: 'heart', body: 'The Bible is full of people who reached the end of themselves — Elijah, David, Job, Jeremiah. God met them with care, rest and presence, not condemnation. He sees you, and your life is precious to Him.', verses },
      { heading: 'A prayer you can pray', icon: 'hand-left', body: 'Lord, I am hurting more than I can say. Please hold me right now, and lead me to the people and help I need. Give me strength for the next hour. Amen.' },
    ],
    followUps: ['What does the Bible say about hope?', 'What does the Bible say about depression & sadness?'],
    refs: verses.map((v) => v.ref),
  };
}

function findPerson(q) {
  const lower = ` ${q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `;
  let best = null;
  for (const p of PEOPLE) {
    for (const a of p.aliases) {
      if (lower.includes(` ${a} `) && (!best || a.length > best.alias.length)) best = { person: p, alias: a };
    }
  }
  return best;
}

export async function askBibleQuestion(question) {
  const q = String(question || '').trim();
  if (!q) {
    return {
      kind: 'empty', title: 'Ask anything about the Bible',
      lead: 'Ask about a verse (“Explain Jeremiah 29:11”), a book (“What is Ruth about?”), a person (“Who was Elijah?”), a topic (“What does the Bible say about anxiety?”) or a question of faith (“Why did Jesus die?”).',
      sections: [], followUps: ['Explain John 3:16', 'Who was Moses?', 'What does the Bible say about fear?'], refs: [],
    };
  }

  const lower = q.toLowerCase();

  // 0) Safety first: someone may be in crisis.
  if (CRISIS_RE.test(lower)) return answerCrisis(q);

  // 1) A Scripture reference anywhere in the question.
  const refs = findReferences(q);
  if (refs.length) return answerPassage(refs[0], q);

  // 2) Known factual / doctrinal questions.
  const faq = FAQ.find((f) => f.patterns.some((p) => new RegExp(p, 'i').test(q)));

  // 3) People and books.
  const personHit = findPerson(q);
  const bookHit = findBookMention(q);
  const asksWho = /\bwho (is|was|were)\b|tell me about|story of|life of|biography|learn from/i.test(q);
  const asksBook = /book of|books of|who wrote|author of|when was .* written|summary|summari[sz]e|overview|what is .* about|what's .* about|theme of|outline|gospel of|letter (of|to)|epistle/i.test(q);

  if (faq && !(asksWho && personHit)) return answerFaq(faq, q);
  if (bookHit && (bookHit.explicit || (asksBook && !(asksWho && personHit)) || (!bookHit.ambiguous && asksBook))) {
    return answerBook(bookHit.bookId, q);
  }
  const topics = scoreTopics(lower);
  if (personHit && (asksWho || (!topics.length && keywordsOf(q).length <= 2))) return answerPerson(personHit.person, q);

  // 4) Topics.
  if (topics.length) return answerTopic(topics[0].topic, q, topics[1] && topics[1].score >= 4 ? topics[1].topic : null);

  // 5) Single book name alone ("Romans", "Genesis").
  if (bookHit && keywordsOf(q).length <= 2) return answerBook(bookHit.bookId, q);
  if (personHit) return answerPerson(personHit.person, q);

  // 6) Search the whole Bible.
  return answerFallback(q);
}

// ---------------------------------------------------------------------------
// Sermon writer
// ---------------------------------------------------------------------------

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// Lower-case a label/sentence for mid-sentence use without breaking proper nouns.
function lc(str) {
  const t = String(str || '');
  if (/^(God|Jesus|Christ|Scripture|The Bible|Holy|Paul|Israel)\b/.test(t)) return t;
  return (t.charAt(0).toLowerCase() + t.slice(1)).replace(/\bgod\b/g, 'God').replace(/\bholy spirit\b/gi, 'Holy Spirit');
}

/** Topic teaching points that cite a verse within bookId chapter:[from..to]. */
function pointsCiting(bookId, chapter, from, to) {
  const out = [];
  for (const t of TOPICS) {
    for (const p of t.points) {
      const hit = p.refs.some((r) => {
        const pr = findReferences(r)[0];
        if (!pr || pr.bookId !== bookId || pr.chapter !== chapter || !pr.vStart) return false;
        return pr.vStart <= to && (pr.vEnd || pr.vStart) >= from;
      });
      if (hit) out.push({ topic: t, point: p });
    }
  }
  return out;
}

function illustrationFor(tags, seed, avoid = [], allowAny = false) {
  const free = ILLUSTRATIONS.filter((i) => !avoid.includes(i.title));
  // Prefer the first tag (the point's own topic), then related topics.
  for (const t of tags) {
    const m = free.filter((i) => i.tags.includes(t));
    if (m.length) return pick(m, seed);
  }
  return allowAny && free.length ? pick(free, seed) : null;
}

function splitClauses(text, n) {
  const parts = text.replace(/([;:,.])\s+/g, '$1\u0000').split('\u0000').map((s) => s.trim()).filter((s) => s.length > 3);
  if (parts.length <= n) return parts;
  // Merge into exactly n balanced groups.
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * parts.length) / n);
    const b = Math.floor(((i + 1) * parts.length) / n);
    out.push(parts.slice(a, b).join(' '));
  }
  return out;
}

/** Picks the most "headline-worthy" clause of a passage for a point title. */
function clauseHeading(text) {
  const clauses = text.replace(/([,;:.?!])\s+/g, '$1\u0000').split('\u0000')
    .map((c) => c.replace(/[,;:.?!]+$/, '').trim())
    .map((c) => c.replace(/^(and|for|but|that|then|now|so|yea|behold|therefore|wherefore|because)\s+/i, '').replace(/^(and|that|for)\s+/i, ''))
    .filter((c) => c.split(/\s+/).length >= 3);
  let best = null;
  for (const c of clauses) {
    const words = c.split(/\s+/).length;
    let score = 0;
    if (/\b(God|LORD|Lord|Jesus|Christ|Spirit|Father)\b/.test(c)) score += 3;
    score += glossaryFor(c, 3).length * 1.5;
    if (words >= 4 && words <= 11) score += 2; else if (words > 16) score -= 2;
    if (/it came to pass|said unto|saith unto|answered and said/i.test(c)) score -= 3;
    if (!best || score > best.score) best = { c, score };
  }
  if (!best) return `“${shortQuote(text, 7)}”`;
  const h = best.c.length > 70 ? shortQuote(best.c, 10) : best.c;
  return `“${h.charAt(0).toUpperCase()}${h.slice(1)}”`;
}

const shortQuote = (s, words = 9) => {
  const w = s.replace(/[“”"]/g, '').split(/\s+/);
  return w.length <= words ? w.join(' ').replace(/[,;:.]$/, '') : w.slice(0, words).join(' ').replace(/[,;:.]$/, '') + '…';
};

const AUDIENCE_NOTES = {
  general: '',
  youth: 'For students: ',
  smallgroup: 'For your group: ',
  children: 'For kids: ',
};

/**
 * Generates a complete sermon manuscript.
 *   input:    a topic ("finding peace in anxiety") and/or a passage ("Philippians 4:4-9")
 *   audience: 'general' | 'youth' | 'smallgroup'
 *   length:   'short' | 'standard' | 'extended'
 *   style:    'expository' | 'topical' | 'evangelistic'
 */
export async function generateSermon({ input, audience = 'general', length = 'standard', style = 'topical' } = {}) {
  const text = String(input || '').trim();
  const seed = hash(`${text}|${audience}|${length}|${style}`);
  const refs = findReferences(text);
  const pointCount = length === 'short' ? 2 : length === 'extended' ? 4 : 3;
  let topic = scoreTopics(text)[0]?.topic || null;

  // Main text.
  let mainParsed = refs[0] || null;
  if (mainParsed && !mainParsed.vStart) {
    // Whole chapter requested: preach the first 18 verses (or the whole chapter if shorter).
    const chLen = Object.keys(await getChapter(mainParsed.bookId, mainParsed.chapter, 'kjv')).length;
    mainParsed = { ...mainParsed, vStart: 1, vEnd: Math.min(chLen, 18) };
    mainParsed.ref = formatRef(mainParsed);
  }
  let main = mainParsed ? await fetchPassage(mainParsed, { maxVerses: 18 }) : null;
  if (main && !topic) {
    const cites = pointsCiting(mainParsed.bookId, mainParsed.chapter, mainParsed.vStart || 1, mainParsed.vEnd || mainParsed.vStart || 200);
    topic = cites[0]?.topic || scoreTopics(main.text)[0]?.topic || null;
  }
  if (!main && topic) {
    mainParsed = findReferences(topic.points[0].refs[0])[0];
    main = await fetchPassage(mainParsed);
  }
  if (!main) {
    const hits = await rankedSearch(keywordsOf(text), { limit: 1 });
    if (hits[0]) {
      mainParsed = findReferences(hits[0].ref)[0];
      main = hits[0];
      topic = scoreTopics(hits[0].text)[0]?.topic || null;
    }
  }
  if (!main) {
    topic = topicById('faith');
    mainParsed = findReferences('Hebrews 11:1')[0];
    main = await fetchPassage(mainParsed);
  }

  const info = BOOK_INFO[mainParsed.bookId];
  const topicLabel = topic ? topic.label : (text || 'God’s Word');
  const subject = text && !refs.length ? text.replace(/^(a |the )?sermon (on|about) /i, '') : topicLabel;
  const prettySubject = subject.charAt(0).toUpperCase() + subject.slice(1);

  // ----- Points -----
  const points = [];
  const expositional = style === 'expository' || (refs.length && !scoreTopics(text).length);
  if (expositional) {
    const ch = await getChapter(mainParsed.bookId, mainParsed.chapter, 'kjv');
    let from = mainParsed.vStart || 1;
    let to = mainParsed.vEnd || (mainParsed.vStart ? mainParsed.vStart : Object.keys(ch).length);
    if (!mainParsed.vStart) to = Math.min(to, from + 17);
    const verseNums = [];
    for (let v = from; v <= to; v++) if (ch[v]) verseNums.push(v);
    let groups;
    if (verseNums.length >= pointCount) {
      groups = [];
      for (let i = 0; i < pointCount; i++) {
        const a = Math.floor((i * verseNums.length) / pointCount);
        const b = Math.floor(((i + 1) * verseNums.length) / pointCount);
        if (b > a) groups.push(verseNums.slice(a, b));
      }
      groups = groups.map((g) => ({ ref: formatRef({ bookId: mainParsed.bookId, chapter: mainParsed.chapter, vStart: g[0], vEnd: g[g.length - 1] }), text: g.map((n) => cleanVerse(ch[n])).join(' '), from: g[0], to: g[g.length - 1] }));
    } else {
      groups = splitClauses(verseNums.map((n) => cleanVerse(ch[n])).join(' '), pointCount).map((c) => ({ ref: main.ref, text: c, clause: true }));
    }
    const usedTerms = new Set();
    const usedPoints = new Set();
    const usedNotes = new Set();
    for (let i = 0; i < groups.length && i < pointCount; i++) {
      const g = groups[i];
      const gFrom = g.from || mainParsed.vStart || 1;
      const gTo = g.to || gFrom;
      // 1) Hand-written commentary on any verse inside this movement.
      let gNote = null;
      for (let v = gFrom; v <= gTo && !gNote; v++) {
        const n = noteFor({ bookId: mainParsed.bookId, chapter: mainParsed.chapter, vStart: v, vEnd: v });
        if (n && !usedNotes.has(n.key)) gNote = n;
      }
      if (gNote) usedNotes.add(gNote.key);
      // 2) A topical teaching point that cites a verse in this movement.
      const citing = pointsCiting(mainParsed.bookId, mainParsed.chapter, gFrom, gTo).filter((c) => !usedPoints.has(c.point.title));
      const cp = citing[0] || null;
      if (cp) usedPoints.add(cp.point.title);
      const scored = g.clause ? null : scoreTopics(g.text)[0];
      const gTopic = cp?.topic || (scored && scored.score >= 3 ? scored.topic : null) || topic;
      const gloss = glossaryFor(g.text, 4).filter((x) => !usedTerms.has(x.term)).slice(0, 2);
      gloss.forEach((x) => usedTerms.add(x.term));

      let body = `Look closely at what the text says: “${shortQuote(g.text, 24)}”`;
      if (gNote) body += `\n\n${gNote.meaning}`;
      else if (cp) body += `\n\n${cp.point.text}`;
      if (gloss.length) body += `\n\n${gloss.map((x) => `Notice the word “${x.term}.” ${x.def}`).join(' ')}`;
      if (!gNote && !cp && gTopic) body += `\n\n${gTopic.overview.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')}`;
      const supportRefs = (cp ? cp.point.refs : (gTopic ? gTopic.points[i % gTopic.points.length].refs : []))
        .filter((r) => !r.startsWith(bookName(mainParsed.bookId) + ' ' + mainParsed.chapter + ':'));
      const support = await fetchMany(supportRefs.slice(0, 2));
      const heading = cp ? cp.point.title : clauseHeading(g.text);
      points.push({
        title: heading,
        body,
        verses: [{ ref: g.ref, text: g.text, bookId: mainParsed.bookId, chapter: mainParsed.chapter, verse: gFrom }, ...support],
        apply: gNote?.apply || (gTopic ? gTopic.practice[i % gTopic.practice.length] : 'Ask God to make this truth real in your life this week.'),
        tags: gTopic ? [gTopic.id] : [],
      });
    }
  } else {
    const src = topic ? topic.points.slice() : [];
    if (pointCount > src.length && topic) {
      const rel = (topic.related || []).map(topicById).find(Boolean);
      if (rel) src.push({ ...rel.points[0], fromRelated: rel });
    }
    for (let i = 0; i < Math.min(pointCount, src.length); i++) {
      const p = src[i];
      const verses = await fetchMany(p.refs.slice(0, 2));
      const owner = p.fromRelated || topic;
      points.push({ title: p.title, body: p.text, verses, apply: owner.practice[i % owner.practice.length], tags: [owner.id] });
    }
  }

  // ----- Title -----
  const titleTemplates = topic ? [
    `${topic.label}: What God Says and Why It Matters`,
    `When Life Meets the Word: ${topic.label}`,
    `Anchored: A Biblical Look at ${topic.label}`,
    `${topic.points[0].title}`,
    `Grace for Real Life: ${topic.label}`,
  ] : [`${prettySubject}`];
  const title = expositional && main
    ? `${main.ref}: ${shortQuote(points[0]?.title.replace(/[“”]/g, '') || main.text, 7)}`
    : pick(titleTemplates, seed);

  const tags = topic ? [topic.id, ...(topic.related || [])] : ['faith', 'grace', 'hope'];
  const introIll = illustrationFor(tags, seed, [], true);
  const used = introIll ? [introIll.title] : [];
  const pointIlls = points.map((p, i) => {
    if (length === 'short') return null;
    const ill = illustrationFor([...p.tags, ...tags], seed + i + 1, used);
    if (ill) used.push(ill.title);
    return ill;
  });

  // ----- Assemble sections -----
  const audiencePrefix = AUDIENCE_NOTES[audience] || '';
  let mainNote = null;
  if (refs.length) {
    for (let v = mainParsed.vStart || 1; v <= (mainParsed.vEnd || mainParsed.vStart || 1) && !mainNote; v++) {
      mainNote = noteFor({ ...mainParsed, vStart: v, vEnd: v });
    }
    if (!mainNote && !mainParsed.vStart) mainNote = noteFor(mainParsed);
  }
  const bigIdea = mainNote?.apply
    ? mainNote.apply
    : topic ? topic.overview.split('. ')[0].replace(/\.$/, '') + '.' : `${main.ref} calls us to trust and follow God wholeheartedly.`;
  const sections = [];

  sections.push({ heading: 'Main text', icon: 'book', verses: [main] });
  sections.push({ heading: 'Big idea', icon: 'bulb', body: bigIdea });

  let introBody = '';
  if (introIll) introBody += `${introIll.text}\n\n`;
  introBody += pick([
    `That story sets the stage for today. ${topic ? `All of us wrestle with ${lc(topicLabel)} at some point.` : ''} Today we open ${main.ref} to hear what God says.`,
    `We all know moments like that. ${topic ? `When it comes to ${lc(topicLabel)}, Scripture is not silent.` : ''} Let’s turn to ${main.ref}.`,
  ], seed).replace(/\s+/g, ' ').trim();
  if (info) introBody += `\n\n${bookIntroLine(mainParsed.bookId)}`;
  introBody += `\n\nWe will see ${points.length} truths: ${points.map((p, i) => `(${i + 1}) ${p.title.replace(/[“”]/g, '')}`).join('; ')}.`;
  sections.push({ heading: 'Introduction', icon: 'megaphone', body: introBody });

  points.forEach((p, i) => {
    let body = p.body;
    if (pointIlls[i]) body += `\n\nIllustration — ${pointIlls[i].title}: ${pointIlls[i].text}`;
    body += `\n\nApplication: ${audiencePrefix}${p.apply}`;
    const verses = i === 0 ? p.verses.filter((v) => v.ref !== main.ref) : p.verses;
    sections.push({ heading: `${ROMAN[i]}. ${p.title}`, icon: 'ribbon', body, verses: verses.length ? verses : p.verses });
  });

  const gospel = style === 'evangelistic'
    ? 'Here is the heart of it: we cannot fix ourselves. “All have sinned, and come short of the glory of God” (Romans 3:23). But “God commendeth his love toward us, in that, while we were yet sinners, Christ died for us” (Romans 5:8). Jesus took our sin on the cross and rose again, and He offers forgiveness and new life to everyone who turns to Him in faith (Romans 10:9). The invitation is open today.'
    : `Every passage ultimately points us to Jesus.${info?.christ ? ` In ${bookName(mainParsed.bookId)}: ${info.christ}` : ''} Because Christ died for our sins and rose again (1 Corinthians 15:3-4), what we have seen today is not merely advice to try harder — it is grace to receive and a Savior to follow.`.trim();
  sections.push({ heading: 'The gospel connection', icon: 'heart', body: gospel });

  const responses = {
    evangelistic: 'If you have never trusted Christ, today can be the day. Admit your need, believe that Jesus died and rose for you, and call on Him as Lord. Talk to someone after the service — we would love to pray with you.',
    expository: `Take ${main.ref} with you this week. Read it each morning, underline one phrase, and ask God to work it into your life.`,
    topical: `Choose one step from today and take it this week. ${points[0] ? points[0].apply : ''}`,
  };
  sections.push({ heading: 'Conclusion & response', icon: 'flag', body: `${pick([
    'Let’s bring it together.', 'So where does this leave us?', 'As we close, remember this.',
  ], seed)} ${points.map((p) => p.title.replace(/[“”]/g, '')).join(', ')} — ${lc(bigIdea)}\n\n${responses[style] || responses.topical}` });

  sections.push({ heading: 'Closing prayer', icon: 'hand-left', body: topic ? topic.prayer : 'Father, thank You for Your Word. Write it on our hearts and help us live it out this week, for the glory of Jesus. Amen.' });

  const discussion = [
    `What stood out to you most from ${main.ref}?`,
    ...points.slice(0, 2).map((p) => `How does “${p.title.replace(/[“”]/g, '')}” challenge or encourage you right now?`),
    'What is one practical step you will take this week?',
    'How can we pray for one another about this?',
  ];
  sections.push({ heading: audience === 'smallgroup' ? 'Group discussion' : 'Questions for reflection', icon: 'chatbubbles', bullets: discussion });

  const minutes = length === 'short' ? '10–15' : length === 'extended' ? '35–45' : '25–30';
  return {
    kind: 'sermon',
    title,
    lead: `${style.charAt(0).toUpperCase() + style.slice(1)} sermon · ${minutes} minutes · Main text: ${main.ref}`,
    sections,
    followUps: [],
    refs: sections.flatMap((s) => (s.verses || []).map((v) => v.ref)),
  };
}

/** Back-compat for older callers. */
export async function generateDevotional(topic) {
  const res = await generateSermon({ input: topic, length: 'short' });
  return { content: toPlainText(res), verses: res.refs, verse: res.refs[0], isOffline: true };
}

export function isAIAvailable() {
  return true;
}
