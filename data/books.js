export const BOOKS = [
  {id:'gen', num:1, name:'Genesis', chapters:50}, {id:'exo', num:2, name:'Exodus', chapters:40},
  {id:'lev', num:3, name:'Leviticus', chapters:27}, {id:'num', num:4, name:'Numbers', chapters:36},
  {id:'deu', num:5, name:'Deuteronomy', chapters:34}, {id:'jos', num:6, name:'Joshua', chapters:24},
  {id:'jdg', num:7, name:'Judges', chapters:21}, {id:'rut', num:8, name:'Ruth', chapters:4},
  {id:'1sa', num:9, name:'1 Samuel', chapters:31}, {id:'2sa', num:10, name:'2 Samuel', chapters:24},
  {id:'1ki', num:11, name:'1 Kings', chapters:22}, {id:'2ki', num:12, name:'2 Kings', chapters:25},
  {id:'1ch', num:13, name:'1 Chronicles', chapters:29}, {id:'2ch', num:14, name:'2 Chronicles', chapters:36},
  {id:'ezr', num:15, name:'Ezra', chapters:10}, {id:'neh', num:16, name:'Nehemiah', chapters:13},
  {id:'est', num:17, name:'Esther', chapters:10}, {id:'job', num:18, name:'Job', chapters:42},
  {id:'psa', num:19, name:'Psalms', chapters:150}, {id:'pro', num:20, name:'Proverbs', chapters:31},
  {id:'ecc', num:21, name:'Ecclesiastes', chapters:12}, {id:'sng', num:22, name:'Song of Solomon', chapters:8},
  {id:'isa', num:23, name:'Isaiah', chapters:66}, {id:'jer', num:24, name:'Jeremiah', chapters:52},
  {id:'lam', num:25, name:'Lamentations', chapters:5}, {id:'ezk', num:26, name:'Ezekiel', chapters:48},
  {id:'dan', num:27, name:'Daniel', chapters:12}, {id:'hos', num:28, name:'Hosea', chapters:14},
  {id:'jol', num:29, name:'Joel', chapters:3}, {id:'amo', num:30, name:'Amos', chapters:9},
  {id:'oba', num:31, name:'Obadiah', chapters:1}, {id:'jon', num:32, name:'Jonah', chapters:4},
  {id:'mic', num:33, name:'Micah', chapters:7}, {id:'nah', num:34, name:'Nahum', chapters:3},
  {id:'hab', num:35, name:'Habakkuk', chapters:3}, {id:'zep', num:36, name:'Zephaniah', chapters:3},
  {id:'hag', num:37, name:'Haggai', chapters:2}, {id:'zec', num:38, name:'Zechariah', chapters:14},
  {id:'mal', num:39, name:'Malachi', chapters:4}, {id:'mat', num:40, name:'Matthew', chapters:28},
  {id:'mrk', num:41, name:'Mark', chapters:16}, {id:'luk', num:42, name:'Luke', chapters:24},
  {id:'jhn', num:43, name:'John', chapters:21}, {id:'act', num:44, name:'Acts', chapters:28},
  {id:'rom', num:45, name:'Romans', chapters:16}, {id:'1co', num:46, name:'1 Corinthians', chapters:16},
  {id:'2co', num:47, name:'2 Corinthians', chapters:13}, {id:'gal', num:48, name:'Galatians', chapters:6},
  {id:'eph', num:49, name:'Ephesians', chapters:6}, {id:'php', num:50, name:'Philippians', chapters:4},
  {id:'col', num:51, name:'Colossians', chapters:4}, {id:'1th', num:52, name:'1 Thessalonians', chapters:5},
  {id:'2th', num:53, name:'2 Thessalonians', chapters:3}, {id:'1ti', num:54, name:'1 Timothy', chapters:6},
  {id:'2ti', num:55, name:'2 Timothy', chapters:4}, {id:'tit', num:56, name:'Titus', chapters:3},
  {id:'phm', num:57, name:'Philemon', chapters:1}, {id:'heb', num:58, name:'Hebrews', chapters:13},
  {id:'jas', num:59, name:'James', chapters:5}, {id:'1pe', num:60, name:'1 Peter', chapters:5},
  {id:'2pe', num:61, name:'2 Peter', chapters:3}, {id:'1jn', num:62, name:'1 John', chapters:5},
  {id:'2jn', num:63, name:'2 John', chapters:1}, {id:'3jn', num:64, name:'3 John', chapters:1},
  {id:'jud', num:65, name:'Jude', chapters:1}, {id:'rev', num:66, name:'Revelation', chapters:22},
];
export function getBookById(id){
  if(!id) return null;
  const s = String(id).toLowerCase().trim();
  if(!s) return null;

  if(!isNaN(s)){
    const n = parseInt(s, 10);
    return BOOKS.find(b => b.num === n);
  }

  const exactMatch = BOOKS.find(b => b.id === s || b.name.toLowerCase() === s);
  if (exactMatch) return exactMatch;

  const startsWithMatch = BOOKS.filter(b => b.name.toLowerCase().startsWith(s));
  if (startsWithMatch.length === 1) return startsWithMatch[0];

  return BOOKS.find(b => b.name.toLowerCase().includes(s));
}
