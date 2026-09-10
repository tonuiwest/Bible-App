// Offline, keyword-grounded Bible Q&A. No API key needed: every answer is
// built from (a) the topic(s) the question's own words match, and (b) a live
// full-text search of the bundled KJV for the significant words the person
// actually typed — so the response changes with the question instead of
// repeating one fixed generic reply.
import { getChapter, searchVerses } from '../data/bibleData';

const STOPWORDS = new Set([
  'what','does','the','bible','say','says','about','how','can','should','with',
  'from','that','this','have','when','where','why','who','which','into','over',
  'your','their','his','her','and','for','are','was','were','will','would',
  'could','a','an','of','in','on','to','is','it','do','i','me','my','you','me',
  'not','but','all','any','some','than','then','there','here','out','just',
  'like','get','got','feel','feeling','feels','been','being','tell','know',
]);

// Topic keyword -> curated, hand-picked verse references + a short teaching.
// Kept intentionally concise; the real substance comes from the actual
// Scripture text fetched at answer time, not from long canned paragraphs.
const TOPICS = {
  anxiety: { label: 'Peace over Anxiety', keywords: ['anxiety','anxious','worry','worried','worrying','stress','stressed','panic','overwhelmed','nervous'], refs: ['Philippians 4:6-7','1 Peter 5:7','Matthew 6:34'],
    teaching: "anxiety isn't something Scripture tells you to hide — it's something you're invited to hand over. Philippians 4:6-7 pairs prayer with thanksgiving as the way worry becomes peace, and 1 Peter 5:7 says plainly that God cares about the details you're carrying." },
  fear: { label: 'From Fear to Faith', keywords: ['fear','afraid','scared','terrified','frightened'], refs: ['Joshua 1:9','2 Timothy 1:7','Isaiah 41:10'],
    teaching: "fear and faith often occupy the same room. 2 Timothy 1:7 says fear isn't what God hands you — power, love, and a sound mind are. Joshua 1:9 ties courage directly to God's presence: 'be strong and of a good courage... for the LORD thy God is with thee.'" },
  grief: { label: 'Comfort in Grief', keywords: ['grief','grieving','loss','death','died','dying','mourning','sad','sadness','depressed','depression','lonely','loneliness','alone'], refs: ['Psalm 34:18','Psalm 147:3','Revelation 21:4'],
    teaching: "grief is not a sign of weak faith — it's the honest cost of love. Psalm 34:18 promises God is close specifically to the brokenhearted, and Revelation 21:4 points to a hope where every tear is finally wiped away." },
  forgiveness: { label: 'Forgiveness', keywords: ['forgive','forgiveness','forgiving','resentment','bitter','bitterness','grudge'], refs: ['Ephesians 4:32','Matthew 6:14-15','Colossians 3:13'],
    teaching: "forgiveness in Scripture is modeled on how we've already been forgiven, not on whether the other person deserves it. Ephesians 4:32 says 'forgiving one another, even as God for Christ's sake hath forgiven you' — it's a response to grace received, not a reward for good behavior." },
  love: { label: 'Love That Never Fails', keywords: ['love','loving','relationship','marriage','husband','wife','boyfriend','girlfriend','dating'], refs: ['1 Corinthians 13:4-7','1 John 4:19','Ephesians 5:25'],
    teaching: "1 Corinthians 13 describes love as patient and kind action, not just a feeling: it 'seeketh not her own,' keeps no record of wrongs, and simply doesn't fail. 1 John 4:19 grounds all of it in one line: 'we love him, because he first loved us.'" },
  purpose: { label: 'Purpose & Direction', keywords: ['purpose','calling','career','job','future','direction','lost','confused','decision'], refs: ['Jeremiah 29:11','Ephesians 2:10','Proverbs 19:21'],
    teaching: "purpose in Scripture is rarely the whole staircase revealed at once — it's the next step. Jeremiah 29:11 promises plans for hope and a future, and Ephesians 2:10 says you were made for good works God 'prepared beforehand' for you specifically." },
  faith: { label: 'Faith & Trust', keywords: ['faith','trust','doubt','doubting','believe','belief','unbelief'], refs: ['Hebrews 11:1','Romans 10:17','Mark 9:24'],
    teaching: "faith is defined in Hebrews 11:1 as 'the substance of things hoped for, the evidence of things not seen' — not the absence of doubt, but trust that keeps moving despite it. Even the man in Mark 9:24 prayed, 'Lord, I believe; help thou mine unbelief.'" },
  strength: { label: 'Strength in Weakness', keywords: ['strength','weak','weakness','tired','exhausted','burned','burnout','struggle','struggling'], refs: ['Isaiah 40:31','Philippians 4:13','2 Corinthians 12:9'],
    teaching: "God's strength in Scripture consistently shows up at the point of human weakness. 2 Corinthians 12:9 records God's own answer to Paul's struggle: 'my strength is made perfect in weakness.' Isaiah 40:31 promises renewed strength to those who wait on the Lord." },
  healing: { label: 'Healing', keywords: ['healing','heal','sick','sickness','illness','disease','pain','hurting','suffering'], refs: ['Psalm 34:18','Jeremiah 30:17','James 5:14-15'],
    teaching: "Scripture holds physical and emotional healing together — Jeremiah 30:17 promises restoration of health, while James 5:14-15 points the suffering toward prayer and community rather than isolation." },
  money: { label: 'Money & Provision', keywords: ['money','finances','financial','debt','poor','poverty','provision','job','wealth'], refs: ['Philippians 4:19','Matthew 6:33','Proverbs 3:9-10'],
    teaching: "Scripture treats provision as something to seek God for directly, not just plan around. Matthew 6:33 reorders priorities — 'seek ye first the kingdom of God' — with promises attached, and Philippians 4:19 assures 'my God shall supply all your need.'" },
  parenting: { label: 'Parenting & Family', keywords: ['parenting','parent','children','child','kids','family','son','daughter'], refs: ['Proverbs 22:6','Ephesians 6:4','Deuteronomy 6:6-7'],
    teaching: "parenting in Scripture is framed as ongoing discipleship, not a one-time lesson. Deuteronomy 6:6-7 pictures teaching woven into everyday moments — 'when thou sittest... walkest... liest down... risest up' — and Ephesians 6:4 balances correction with not provoking children to wrath." },
  temptation: { label: 'Temptation & Sin', keywords: ['temptation','tempted','sin','sinning','addiction','addicted','lust','habit'], refs: ['1 Corinthians 10:13','James 1:14-15','Galatians 5:16'],
    teaching: "1 Corinthians 10:13 promises no temptation is beyond what's common to everyone, and that God always provides 'a way to escape.' Galatians 5:16 offers the practical strategy: walk in the Spirit, and the flesh's pull loses its grip." },
  salvation: { label: 'Salvation', keywords: ['salvation','saved','sin','heaven','eternal','gospel','jesus','christ'], refs: ['John 3:16','Romans 10:9','Ephesians 2:8-9'],
    teaching: "the gospel in Scripture is framed as gift, not achievement. Ephesians 2:8-9 is explicit: 'by grace are ye saved through faith... not of works, lest any man should boast.' John 3:16 puts the motive plainly — God's love for the world." },
  prayer: { label: 'Prayer', keywords: ['prayer','praying','pray'], refs: ['Philippians 4:6','Matthew 6:9-13','James 5:16'],
    teaching: "prayer in Scripture is less a formula and more a relationship kept current. Philippians 4:6 pairs it with thanksgiving, and Matthew 6:9-13 gives Jesus's own model for how to pray with both reverence and honesty." },
  wisdom: { label: 'Wisdom', keywords: ['wisdom','wise','guidance','decision','confused','unsure'], refs: ['James 1:5','Proverbs 3:5-6','Proverbs 2:6'],
    teaching: "James 1:5 makes wisdom something to simply ask for: 'if any of you lack wisdom, let him ask of God, that giveth to all men liberally.' Proverbs 3:5-6 pairs that asking with trusting God over your own understanding." },
  peace: { label: 'Peace', keywords: ['peace','calm','rest','restless'], refs: ['John 14:27','Philippians 4:7','Isaiah 26:3'],
    teaching: "the peace Jesus offers in John 14:27 is deliberately distinguished from the world's version: 'not as the world giveth, give I unto you.' Isaiah 26:3 ties that peace directly to a mind fixed on God." },
  joy: { label: 'Joy', keywords: ['joy','happy','happiness','joyful'], refs: ['Psalm 30:5','Nehemiah 8:10','John 15:11'],
    teaching: "biblical joy is presented as sturdier than circumstance. Psalm 30:5 promises 'joy cometh in the morning' after a night of weeping, and Nehemiah 8:10 calls 'the joy of the LORD' itself a source of strength." },
  hope: { label: 'Hope', keywords: ['hope','hopeless','despair','discouraged'], refs: ['Romans 15:13','Jeremiah 29:11','Lamentations 3:22-23'],
    teaching: "hope in Scripture is renewed rather than used up. Lamentations 3:22-23 says God's mercies 'are new every morning,' and Romans 15:13 calls God himself 'the God of hope,' able to fill you with joy and peace 'in believing.'" },
  anger: { label: 'Anger', keywords: ['anger','angry','frustrated','frustration','rage'], refs: ['Ephesians 4:26','James 1:19-20','Proverbs 15:1'],
    teaching: "Scripture doesn't demand you never feel anger — Ephesians 4:26 says 'be ye angry, and sin not' — but it does ask you not to let it fester or dictate your words, as Proverbs 15:1 and James 1:19-20 both stress." },
  pride: { label: 'Pride & Humility', keywords: ['pride','proud','humility','humble','ego'], refs: ['Proverbs 16:18','James 4:10','Philippians 2:3'],
    teaching: "pride and its fall are directly linked in Proverbs 16:18, while James 4:10 offers the alternative: 'humble yourselves in the sight of the Lord, and he shall lift you up.'" },
  work: { label: 'Work', keywords: ['work','job','career','workplace','colleague','boss'], refs: ['Colossians 3:23','Proverbs 16:3','Ecclesiastes 3:13'],
    teaching: "Colossians 3:23 reframes ordinary work as an offering: 'whatsoever ye do, do it heartily, as to the Lord.' Proverbs 16:3 invites committing your work to God directly, trusting He'll establish the plans." },
};

const DEFAULT_REFS = ['Romans 8:28', 'Isaiah 41:10', 'Psalm 23:1'];

function extractKeywords(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function scoreTopics(question) {
  const lower = String(question || '').toLowerCase();
  const scores = [];
  for (const [key, t] of Object.entries(TOPICS)) {
    let score = 0;
    for (const kw of t.keywords) {
      if (lower.includes(kw)) score += 2;
    }
    if (score > 0) scores.push({ key, score });
  }
  return scores.sort((a, b) => b.score - a.score);
}

function parseRef(ref) {
  const m = String(ref || '').match(/^([1-3]?\s?[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  return { bookName: m[1].trim(), chapter: parseInt(m[2], 10), vStart: parseInt(m[3], 10), vEnd: m[4] ? parseInt(m[4], 10) : parseInt(m[3], 10) };
}

async function fetchRefText(ref) {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  try {
    const chapterVerses = await getChapter(parsed.bookName, parsed.chapter, 'kjv');
    const parts = [];
    for (let v = parsed.vStart; v <= parsed.vEnd; v++) {
      if (chapterVerses[v]) parts.push(chapterVerses[v]);
    }
    if (!parts.length) return null;
    return { ref, text: parts.join(' ') };
  } catch {
    return null;
  }
}

async function groundedVerses(question, curatedRefs) {
  const keywords = extractKeywords(question);
  let searchHits = [];
  for (const kw of keywords.slice(0, 3)) {
    const hits = await searchVerses(kw, 'kjv', 2);
    searchHits.push(...hits);
  }
  const curated = (await Promise.all(curatedRefs.map(fetchRefText))).filter(Boolean);

  const seen = new Set(curated.map((v) => v.ref));
  const searchVersesClean = searchHits
    .filter((h) => !seen.has(h.ref) && (seen.add(h.ref) || true))
    .map((h) => ({ ref: h.ref, text: h.text }));

  return [...curated, ...searchVersesClean].slice(0, 5);
}

/**
 * Answers a typed question by matching it against real topic keywords and
 * grounding the response in Scripture text actually pulled from the bundled
 * KJV — both the topic's curated references and a live search of the
 * question's own significant words. Always resolves, and always reflects
 * what was actually typed rather than one fixed fallback reply.
 */
export async function askBibleQuestion(question) {
  const q = String(question || '').trim();
  if (!q) {
    return {
      answer: 'Ask me anything about faith, Scripture, or something you\'re going through — for example, "What does the Bible say about forgiveness?" or "I\'m anxious about my future."',
      verses: [],
      source: 'offline',
      isOffline: true,
    };
  }

  const matches = scoreTopics(q);
  const primary = matches[0] ? TOPICS[matches[0].key] : null;
  const curatedRefs = primary ? primary.refs : DEFAULT_REFS;
  const verses = await groundedVerses(q, curatedRefs);

  const intro = primary
    ? `On "${q}" — ${primary.teaching}`
    : `Here's Scripture that speaks to "${q}", drawn from a search of the passages that use those same words:`;

  const versesBlock = verses.length
    ? verses.map((v) => `**${v.ref}**\n"${v.text}"`).join('\n\n')
    : "I couldn't find a close verse match for those exact words, but here's a place to start:\n\n" +
      (await Promise.all(DEFAULT_REFS.map(fetchRefText))).filter(Boolean).map((v) => `**${v.ref}**\n"${v.text}"`).join('\n\n');

  const answer = `${intro}\n\n${versesBlock}\n\nTry rereading these slowly with your own situation in mind — or ask a follow-up and I'll search again with your new words.`;

  return {
    answer,
    verses: verses.map((v) => v.ref),
    source: primary ? 'offline-topic+search' : 'offline-search',
    isOffline: true,
  };
}

/**
 * Builds a short devotional around a typed topic, using the same
 * keyword-grounded Scripture lookup as askBibleQuestion.
 */
export async function generateDevotional(topic, verse = null) {
  const t = String(topic || '').trim() || 'today';
  const matches = scoreTopics(t);
  const primary = matches[0] ? TOPICS[matches[0].key] : null;
  const curatedRefs = verse ? [verse, ...(primary ? primary.refs : DEFAULT_REFS)] : (primary ? primary.refs : DEFAULT_REFS);
  const verses = await groundedVerses(t, curatedRefs);
  const anchor = verses[0];

  const teaching = primary
    ? primary.teaching
    : `whatever "${t}" means for you today, Scripture consistently points back to God's nearness in the specifics of ordinary life, not just the big moments.`;

  const content =
    `**${primary ? primary.label : t}**\n\n` +
    `**Verse: ${anchor ? anchor.ref : curatedRefs[0]}**\n` +
    (anchor ? `"${anchor.text}"\n\n` : '\n') +
    `On ${t}, ${teaching}\n\n` +
    `**Reflection:** Where in your life right now does this verse actually apply — not in general, but today, specifically?\n\n` +
    `**Prayer:** Lord, meet me in what I'm facing with "${t}" today. Let this word settle from something I've read into something I actually live. Amen.`;

  return {
    content,
    source: primary ? 'offline-topic+search' : 'offline-search',
    topic: t,
    verse: anchor ? anchor.ref : curatedRefs[0],
    verses: verses.map((v) => v.ref),
    isOffline: true,
  };
}

export function isAIAvailable() {
  return false;
}
