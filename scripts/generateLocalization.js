const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const languages = [
  ['af', 'Afrikaans', 'af'], ['az', 'Azerbaijani', 'az'], ['bs', 'Bosnian', 'bs'],
  ['ca', 'Catalan', 'ca'], ['cs', 'Czech', 'cs'], ['cy', 'Welsh', 'cy'],
  ['da', 'Danish', 'da'], ['de', 'German', 'de'], ['et', 'Estonian', 'et'],
  ['en-GB', 'English (United Kingdom)', 'en'], ['en-US', 'English (United States)', 'en'],
  ['es-ES', 'Spanish (Spain)', 'es'], ['es-419', 'Spanish (Latin America)', 'es'],
  ['eu', 'Basque', 'eu'], ['fil', 'Filipino', 'tl'], ['fr-CA', 'French (Canada)', 'fr'],
  ['fr-FR', 'French (France)', 'fr'], ['ga', 'Irish', 'ga'], ['gl', 'Galician', 'gl'],
  ['hr', 'Croatian', 'hr'], ['id', 'Indonesian', 'id'], ['zu', 'Zulu', 'zu'],
  ['is', 'Icelandic', 'is'], ['it', 'Italian', 'it'], ['sw', 'Swahili', 'sw'],
  ['lv', 'Latvian', 'lv'], ['lt', 'Lithuanian', 'lt'], ['hu', 'Hungarian', 'hu'],
  ['ms', 'Malay', 'ms'], ['nl', 'Dutch', 'nl'], ['no', 'Norwegian', 'no'],
  ['uz', 'Uzbek', 'uz'], ['pl', 'Polish', 'pl'], ['pt-BR', 'Portuguese (Brazil)', 'pt'],
  ['pt-PT', 'Portuguese (Portugal)', 'pt'], ['ro', 'Romanian', 'ro'],
  ['sq', 'Albanian', 'sq'], ['sk', 'Slovak', 'sk'], ['sl', 'Slovenian', 'sl'],
  ['sr-Latn', 'Serbian (Latin)', 'sr'], ['fi', 'Finnish', 'fi'], ['sv', 'Swedish', 'sv'],
  ['vi', 'Vietnamese', 'vi'], ['tr', 'Turkish', 'tr'], ['el', 'Greek', 'el'],
  ['be', 'Belarusian', 'be'], ['bg', 'Bulgarian', 'bg'], ['ky', 'Kyrgyz', 'ky'],
  ['kk', 'Kazakh', 'kk'], ['mk', 'Macedonian', 'mk'], ['mn', 'Mongolian', 'mn'],
  ['ru', 'Russian', 'ru'], ['sr', 'Serbian (Cyrillic)', 'sr'], ['uk', 'Ukrainian', 'uk'],
  ['ka', 'Georgian', 'ka'], ['hy', 'Armenian', 'hy'], ['he', 'Hebrew', 'iw'],
  ['ur', 'Urdu', 'ur'], ['ar', 'Arabic', 'ar'], ['fa', 'Persian', 'fa'],
  ['am', 'Amharic', 'am'], ['ne', 'Nepali', 'ne'], ['mr', 'Marathi', 'mr'],
  ['hi', 'Hindi', 'hi'], ['as', 'Assamese', 'as'], ['bn', 'Bengali', 'bn'],
  ['pa', 'Punjabi', 'pa'], ['gu', 'Gujarati', 'gu'], ['or', 'Odia', 'or'],
  ['ta', 'Tamil', 'ta'], ['te', 'Telugu', 'te'], ['kn', 'Kannada', 'kn'],
  ['ml', 'Malayalam', 'ml'], ['si', 'Sinhala', 'si'], ['th', 'Thai', 'th'],
  ['lo', 'Lao', 'lo'], ['my', 'Burmese', 'my'], ['km', 'Khmer', 'km'],
  ['ko', 'Korean', 'ko'], ['zh-HK', 'Chinese (Hong Kong)', 'zh-TW'],
  ['ja', 'Japanese', 'ja'], ['zh-CN', 'Chinese (Simplified)', 'zh-CN'],
  ['zh-TW', 'Chinese (Traditional)', 'zh-TW'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function collectUiStrings() {
  const found = new Set();
  const dirs = ['screens', 'components'];
  const files = dirs.flatMap((dir) => fs.readdirSync(path.join(root, dir))
    .filter((name) => name.endsWith('.js') && name !== 'LocalizedText.js' && name !== 'LocalizedReactNative.js')
    .map((name) => path.join(root, dir, name)));
  files.push(path.join(root, 'data', 'readingPlans.js'));
  files.push(path.join(root, 'data', 'books.js'));

  const add = (value) => {
    const text = normalize(value);
    if (text.length > 1 && text.length <= 180 && /[A-Za-z]/.test(text)) found.add(text);
  };

  for (const file of files) {
    const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous', plugins: ['jsx'] });
    const visit = (node, inText = false, parent = null) => {
      if (!node || typeof node !== 'object') return;
      const isText = node.type === 'JSXElement' && node.openingElement.name.type === 'JSXIdentifier'
        && node.openingElement.name.name === 'Text';
      const insideText = inText || isText;

      if (insideText && node.type === 'JSXText') add(node.value);
      if (node.type === 'JSXAttribute'
        && ['placeholder', 'title', 'label', 'subtitle', 'accessibilityLabel'].includes(node.name.name)
        && node.value?.type === 'StringLiteral') add(node.value.value);
      if (node.type === 'StringLiteral' && (insideText || /\s/.test(node.value))) add(node.value);
      if (node.type === 'StringLiteral' && parent?.type === 'ObjectProperty'
        && ['name', 'label', 'title', 'subtitle', 'description', 'kicker', 'q'].includes(parent.key.name)) {
        add(node.value);
      }
      if (node.type === 'TemplateElement' && /\s/.test(node.value.raw)) add(node.value.raw);

      for (const [key, value] of Object.entries(node)) {
        if (key === 'loc' || key === 'start' || key === 'end') continue;
        if (Array.isArray(value)) value.forEach((child) => visit(child, insideText, node));
        else if (value && typeof value === 'object') visit(value, insideText, node);
      }
    };
    visit(ast);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

async function translateLines(lines, target) {
  const translated = [];
  for (let start = 0; start < lines.length;) {
    let end = start;
    let chars = 0;
    while (end < lines.length && chars + lines[end].length < 1600) {
      chars += lines[end].length + 1;
      end += 1;
    }
    if (end === start) end += 1;

    const input = lines.slice(start, end).join('\n');
    let result;
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(input)}`;
        const response = await fetch(url);
        if (!response.ok) {
          const error = new Error(`Translation service returned HTTP ${response.status}`);
          error.status = response.status;
          error.retryAfter = response.headers.get('retry-after');
          throw error;
        }
        const payload = await response.json();
        result = payload[0].map((segment) => segment[0]).join('').split('\n');
        if (result.length !== end - start) throw new Error('Translation service did not preserve line boundaries');
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          const retryAfterMs = Number(error.retryAfter) * 1000;
          const delay = error.status === 429
            ? (Number.isFinite(retryAfterMs) && retryAfterMs > 0
              ? retryAfterMs
              : 15_000 * (2 ** attempt))
            : 1000 * (attempt + 1);
          await sleep(delay);
        }
      }
    }
    if (!result) throw lastError;
    translated.push(...result);
    start = end;
  }
  return translated;
}

async function translateText(text, target) {
  const lines = text.split('\n');
  const output = await translateLines(lines, target);
  return output.join('\n');
}

function charCount(value) {
  return Array.from(value).length;
}

function getLocalizedShortDescription(uiMap) {
  const holyBible = uiMap['The Holy Bible'];
  const kjv = uiMap.KJV;
  const listen = uiMap['Listen to chapter'];
  const plans = uiMap['Reading plans'];
  const candidates = [
    [holyBible, kjv, listen, plans],
    [holyBible, kjv, plans],
    [holyBible, plans],
  ].filter((parts) => parts.every(Boolean)).map((parts) => parts.join(' · '));
  return candidates.find((candidate) => charCount(candidate) <= 80);
}

function shortenReleaseNotes(releaseNotes) {
  const lines = releaseNotes.split(/\r?\n/);
  let removed = 0;
  while (charCount(lines.join('\n')) > 500) {
    const lastBullet = lines.findLastIndex((line) => line.startsWith('•'));
    if (lastBullet < 0) break;
    lines.splice(lastBullet, 1);
    removed += 1;
  }
  return { value: lines.join('\n').trim(), removed };
}

function getStoreSource() {
  const listing = fs.readFileSync(path.join(root, 'store', 'PLAY_STORE_LISTING.md'), 'utf8');
  const notesFile = fs.readFileSync(path.join(root, 'store', 'RELEASE_NOTES.md'), 'utf8');
  const liveSourcePath = path.join(root, 'store', 'PLAY_STORE_LIVE_LISTING.json');
  const liveSource = process.argv.includes('--live-listing-source')
    ? JSON.parse(fs.readFileSync(liveSourcePath, 'utf8'))
    : null;
  const title = liveSource?.title || listing.match(/## App name[\s\S]*?\*\*Recommended:\*\* `([^`]+)`/)?.[1];
  const shortDescription = liveSource?.shortDescription || listing.match(/## Short description[\s\S]*?\*\*Recommended:\*\* `([^`]+)`/)?.[1];
  const fullDescription = liveSource?.fullDescription || listing.match(/## Full description[\s\S]*?```([\s\S]*?)```/)?.[1]?.trim();
  const releaseNotes = notesFile.match(/<en-US>\s*([\s\S]*?)\s*<\/en-US>/)?.[1]?.trim();
  if (!title || !shortDescription || !fullDescription || !releaseNotes) {
    throw new Error('Could not read the English Play listing and release notes from the store source files.');
  }
  return { title, shortDescription, fullDescription, releaseNotes };
}

async function main() {
  if (languages.length < 80) throw new Error(`Expected at least 80 Play locales, found ${languages.length}.`);
  const storeOnly = process.argv.includes('--store-only');
  const refreshReleaseNotes = process.argv.includes('--refresh-release-notes');
  const refreshListingFields = process.argv.includes('--refresh-listing-fields');
  const uiStrings = collectUiStrings();
  const sourceListing = getStoreSource();
  const stringsPath = path.join(root, 'localization', 'strings.json');
  const previous = fs.existsSync(stringsPath) ? JSON.parse(fs.readFileSync(stringsPath, 'utf8')) : {};
  const uiResources = previous.strings || {};
  const storeDir = path.join(root, 'store', 'locales');
  fs.mkdirSync(storeDir, { recursive: true });
  fs.mkdirSync(path.dirname(stringsPath), { recursive: true });
  let completed = 0;
  let nextIndex = 0;
  let saveChain = Promise.resolve();
  const persistStrings = () => {
    const snapshot = `${JSON.stringify({
      sourceLocale: 'en',
      machineTranslated: true,
      humanReviewed: false,
      languages: languages.map(([code, name]) => ({ code, name })),
      strings: uiResources,
    })}\n`;
    saveChain = saveChain.then(() => fs.writeFileSync(stringsPath, snapshot, 'utf8'));
    return saveChain;
  };
  const worker = async () => {
    while (nextIndex < languages.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const [locale, name, target] = languages[currentIndex];
      process.stdout.write(`Translating ${locale} (${name})... `);
      const currentMap = uiResources[locale] || {};
      const uiMap = { ...currentMap };
      if (!storeOnly) {
        const missingStrings = uiStrings.filter((source) => !(source in currentMap));
        const missingTranslated = target === 'en'
          ? missingStrings
          : await translateLines(missingStrings, target);
        missingStrings.forEach((source, index) => {
          uiMap[source] = missingTranslated[index] || source;
        });
        uiResources[locale] = uiMap;
        await persistStrings();
      }

      const localeFile = path.join(storeDir, `${locale}.json`);
      let listing;
      let sourceAdaptations = {};
      if (fs.existsSync(localeFile)) {
        const existing = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
        listing = existing.listing;
        sourceAdaptations = existing.sourceAdaptations || {};
      } else {
        if (storeOnly) throw new Error(`Missing store draft for ${locale}; store-only mode cannot translate it.`);
        listing = {};
        for (const [key, value] of Object.entries(sourceListing)) {
          listing[key] = target === 'en' ? value : await translateText(value, target);
        }
      }
      if (refreshReleaseNotes) {
        listing.releaseNotes = target === 'en'
          ? sourceListing.releaseNotes
          : await translateText(sourceListing.releaseNotes, target);
        delete sourceAdaptations.releaseNotes;
      }
      if (refreshListingFields) {
        for (const [key, value] of Object.entries(sourceListing)) {
          if (key === 'releaseNotes') continue;
          listing[key] = target === 'en' ? value : await translateText(value, target);
          delete sourceAdaptations[key];
        }
      }
      if (charCount(listing.title) > 30) {
        const localizedTitle = uiMap['The Holy Bible'] || uiMap.KJV;
        if (!localizedTitle || charCount(localizedTitle) > 30) {
          throw new Error(`No localized title fits the Play limit for ${locale}.`);
        }
        listing.title = localizedTitle;
        sourceAdaptations.title = 'The Holy Bible';
      }
      if (charCount(listing.shortDescription) > 80) {
        const localizedShortDescription = getLocalizedShortDescription(uiMap);
        if (!localizedShortDescription) {
          throw new Error(`No localized short description fits the Play limit for ${locale}.`);
        }
        listing.shortDescription = localizedShortDescription;
        sourceAdaptations.shortDescription =
          'Localized app labels: The Holy Bible · KJV · Listen to chapter · Reading plans';
      }
      if (charCount(listing.releaseNotes) > 500) {
        const shortened = shortenReleaseNotes(listing.releaseNotes);
        if (charCount(shortened.value) > 500) {
          throw new Error(`Could not shorten release notes to the Play limit for ${locale}.`);
        }
        listing.releaseNotes = shortened.value;
        sourceAdaptations.releaseNotes =
          `Removed ${shortened.removed} trailing bullet(s) to fit Play's 500-character limit.`;
      }
      const limits = {
        title: charCount(listing.title) <= 30,
        shortDescription: charCount(listing.shortDescription) <= 80,
        fullDescription: charCount(listing.fullDescription) <= 4000,
        releaseNotes: charCount(listing.releaseNotes) <= 500,
      };
      fs.writeFileSync(localeFile, `${JSON.stringify({
        locale,
        language: name,
        sourceLocale: 'en-US',
        machineTranslated: target !== 'en',
        humanReviewed: false,
        listing,
        sourceAdaptations,
        limits,
      }, null, 2)}\n`, 'utf8');
      completed += 1;
      process.stdout.write(`done (${completed}/${languages.length})\n`);
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));

  await persistStrings();
  process.stdout.write(`Wrote ${languages.length} locale listings and ${uiStrings.length} app strings.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
