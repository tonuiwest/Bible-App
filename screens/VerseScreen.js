import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Share, Alert, Modal } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import VersionSwitcher from '../components/VersionSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import ProgressBar from '../components/ProgressBar';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVersion } from '../context/VersionContext';
import { usePlanner } from '../context/PlannerContext';
import { getChapter } from '../data/bibleData';
import { BOOKS, getBookById } from '../data/books';
import { AdManager } from '../ads/AdManager';
import { saveLastRead, recordReadingDay } from '../utils/storage';
import * as Speech from 'expo-speech';
import VoiceSheet from '../components/VoiceSheet';
import { getTtsSettings, speechOptions, NARRATOR_STYLES } from '../utils/tts';

const BOOKMARKS_KEY = 'bookmarks';
const HIGHLIGHTS_KEY = 'verse_highlights_v1';
const FONT_KEY = 'reader_font_size';
const FONT_SIZES = [14, 16, 18, 20, 23, 26];

const HIGHLIGHT_COLORS = [
  { id: 'gold', light: 'rgba(240,200,90,0.38)', dark: 'rgba(240,200,90,0.22)', dot: '#E8C15A' },
  { id: 'green', light: 'rgba(76,190,120,0.30)', dark: 'rgba(76,190,120,0.22)', dot: '#4CBE78' },
  { id: 'blue', light: 'rgba(90,160,230,0.28)', dark: 'rgba(90,160,230,0.22)', dot: '#5AA0E6' },
  { id: 'rose', light: 'rgba(235,120,150,0.28)', dark: 'rgba(235,120,150,0.22)', dot: '#EB7896' },
];

function neighbourChapter(bookId, chapter, dir) {
  const book = getBookById(bookId);
  if (!book) return null;
  const idx = BOOKS.findIndex((b) => b.id === book.id);
  if (dir > 0) {
    if (chapter < book.chapters) return { bookId: book.id, bookName: book.name, chapter: chapter + 1 };
    const nb = BOOKS[idx + 1];
    return nb ? { bookId: nb.id, bookName: nb.name, chapter: 1 } : null;
  }
  if (chapter > 1) return { bookId: book.id, bookName: book.name, chapter: chapter - 1 };
  const pb = BOOKS[idx - 1];
  return pb ? { bookId: pb.id, bookName: pb.name, chapter: pb.chapters } : null;
}

export default function VerseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors, fonts, isDark } = useTheme();
  const { version } = useVersion();
  const { markReadingRead, getPlan, getProgress } = usePlanner();
  const bottomPad = useContentBottomPad();
  const p = route.params || {};
  const bookId = p.bookId || 'gen';
  const bookName = p.bookName || getBookById(bookId)?.name || 'Genesis';
  const chapter = p.chapter || 1;
  const planId = p.planId;
  const dayIndex = p.dayIndex;
  const readingIndex = p.readingIndex || 0;
  const highlightVerse = p.highlightVerse;

  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [unlocked, setUnlocked] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [pending, setPending] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [highlights, setHighlights] = useState({});
  const [fontIdx, setFontIdx] = useState(1);
  const [flash, setFlash] = useState(null);
  const [planNote, setPlanNote] = useState(null);
  const listRef = useRef(null);
  const speakToken = useRef(0);
  const [tts, setTts] = useState(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const plan = planId ? getPlan(planId) : null;
  const planDay = plan && dayIndex != null ? plan.days[dayIndex] : null;

  const refreshUnlockState = useCallback(async () => {
    const ok = await AdManager.isAudioUnlocked();
    setUnlocked(ok);
    return ok;
  }, []);

  useFocusEffect(useCallback(() => { refreshUnlockState(); }, [refreshUnlockState]));

  useEffect(() => {
    (async () => {
      try {
        const f = await AsyncStorage.getItem(FONT_KEY);
        if (f != null) setFontIdx(Math.max(0, Math.min(FONT_SIZES.length - 1, parseInt(f, 10))));
        const h = await AsyncStorage.getItem(HIGHLIGHTS_KEY);
        if (h) setHighlights(JSON.parse(h));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSel(new Set());
      const c = await getChapter(bookId, chapter, version || 'kjv');
      if (cancelled) return;
      const arr = Object.entries(c)
        .map(([n, t]) => ({ num: parseInt(n, 10), text: String(t).trim() }))
        .sort((a, b) => a.num - b.num);
      setVerses(arr);
      setLoading(false);
      // Continue-reading + streak tracking.
      saveLastRead({ bookId, bookName, chapter, at: Date.now() });
      recordReadingDay();
    })();
    return () => { cancelled = true; };
  }, [bookId, chapter, version]);

  // Jump to (and briefly glow) a verse opened from Search / Saved / AI.
  useEffect(() => {
    if (loading || !highlightVerse || !verses.length) return;
    const idx = verses.findIndex((v) => v.num === highlightVerse);
    if (idx < 0) return;
    setFlash(highlightVerse);
    setTimeout(() => {
      try { listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.2, animated: true }); } catch {}
    }, 250);
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [loading, highlightVerse, verses.length]);

  // Reading-plan tracking: opening a plan reading marks it read; once every
  // reading of the day has been opened, the day completes automatically.
  useEffect(() => {
    if (loading || !planId || dayIndex == null) return;
    (async () => {
      const result = await markReadingRead(planId, dayIndex, readingIndex);
      if (result?.completedPlan) {
        Alert.alert('Reading Plan Complete! 🎉', 'Nice work finishing this reading plan. You can restart it from Reading Plans any time.');
      } else if (result?.completedDay) {
        setPlanNote('Day complete — great job!');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, planId, dayIndex, readingIndex]);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
      const list = JSON.parse(raw || '[]');
      setBookmarkedIds(new Set(list.map((b) => b.id)));
    })();
  }, [bookId, chapter]);

  useEffect(() => () => { speakToken.current += 1; Speech.stop(); }, []);
  useEffect(() => { getTtsSettings().then(setTts); }, []);

  const goBack = () => {
    stopSpeech();
    AdManager.tryShowInterstitial({ isNaturalBreak: true });
    navigation.goBack();
  };

  const goChapter = (dir) => {
    const n = neighbourChapter(bookId, chapter, dir);
    if (!n) return;
    stopSpeech();
    AdManager.tryShowInterstitial();
    navigation.replace('Verse', n);
  };

  const goNextPlanReading = () => {
    if (!plan || !planDay) return;
    let d = dayIndex;
    let r = readingIndex + 1;
    if (r >= planDay.length) { d = dayIndex + 1; r = 0; }
    if (!plan.days[d]) { navigation.goBack(); return; }
    const reading = plan.days[d][r];
    stopSpeech();
    AdManager.tryShowInterstitial({ isNaturalBreak: true });
    navigation.replace('Verse', {
      bookId: reading.b, bookName: getBookById(reading.b)?.name, chapter: reading.c,
      planId, dayIndex: d, readingIndex: r,
    });
  };

  const changeFont = async (delta) => {
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, fontIdx + delta));
    setFontIdx(next);
    try { await AsyncStorage.setItem(FONT_KEY, String(next)); } catch {}
  };

  // ---------------- Audio ----------------
  const onAudio = async (num) => {
    const ok = await refreshUnlockState();
    if (!ok) { setPending(num); setSheet(true); return; }
    play(num);
  };

  const stopSpeech = () => {
    speakToken.current += 1; // invalidates callbacks of whatever was playing
    Speech.stop();
    setPlaying(null);
  };

  const play = (num) => {
    const idx = verses.findIndex((v) => v.num === num);
    if (idx < 0) return;
    const wasPlaying = playing;
    stopSpeech();
    if (wasPlaying === num) return;
    const token = speakToken.current;
    // Continuous read-aloud: keeps going verse after verse until stopped.
    const speakFrom = (i) => {
      if (token !== speakToken.current) return;
      const v = verses[i];
      if (!v) { setPlaying(null); return; }
      setPlaying(v.num);
      Speech.speak(v.text.replace(/^\[[^\]]*\]\s*/, ''), {
        ...speechOptions(tts),
        onDone: () => speakFrom(i + 1),
        onStopped: () => { if (token === speakToken.current) setPlaying(null); },
        onError: () => { if (token === speakToken.current) setPlaying(null); },
      });
    };
    speakFrom(idx);
  };

  const unlock = async () => {
    setUnlocking(true);
    const earned = await AdManager.showRewarded();
    setUnlocking(false);
    if (earned) {
      await refreshUnlockState();
      setSheet(false);
      Alert.alert('Unlocked', 'Audio is unlocked for 1 hour — across every book and chapter.');
      if (pending) play(pending);
    } else {
      Alert.alert(
        'Not unlocked',
        'No ad was available just then. This is usually temporary — tap Retry to try again.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Retry', onPress: unlock }]
      );
    }
  };

  // ---------------- Bookmarks / highlights / share ----------------
  const toggleBookmark = async (verse) => {
    const id = `${bookId}-${chapter}-${verse.num}`;
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    const list = JSON.parse(raw || '[]');
    const exists = list.some((b) => b.id === id);
    const next = exists
      ? list.filter((b) => b.id !== id)
      : [...list, { id, bookId, bookName, chapter, verse: verse.num, text: verse.text, createdAt: Date.now() }];
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    setBookmarkedIds(new Set(next.map((b) => b.id)));
  };

  const selectedVerses = () => verses.filter((v) => sel.has(v.num));

  const refLabel = (chosen) => {
    const nums = chosen.map((v) => v.num);
    const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    if (nums.length === 1) return `${bookName} ${chapter}:${nums[0]}`;
    if (contiguous) return `${bookName} ${chapter}:${nums[0]}-${nums[nums.length - 1]}`;
    return `${bookName} ${chapter}:${nums.join(',')}`;
  };

  const shareSelected = async () => {
    const chosen = selectedVerses();
    if (!chosen.length) return;
    const text = `“${chosen.map((v) => v.text).join(' ')}”\n— ${refLabel(chosen)} (${String(version || 'kjv').toUpperCase()})`;
    try {
      const result = await Share.share({ message: text });
      if (result?.action !== Share.dismissedAction) AdManager.tryShowInterstitial({ isNaturalBreak: true });
    } catch {}
  };

  const bookmarkSelected = async () => {
    for (const v of selectedVerses()) {
      if (!bookmarkedIds.has(`${bookId}-${chapter}-${v.num}`)) await toggleBookmark(v);
    }
    setSel(new Set());
  };

  const highlightSelected = async (colorId) => {
    const next = { ...highlights };
    for (const v of selectedVerses()) {
      const id = `${bookId}-${chapter}-${v.num}`;
      if (colorId === null || next[id] === colorId) delete next[id];
      else next[id] = colorId;
    }
    setHighlights(next);
    setSel(new Set());
    try { await AsyncStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(next)); } catch {}
  };

  const askAI = () => {
    const chosen = selectedVerses();
    if (!chosen.length) return;
    setSel(new Set());
    navigation.navigate('AIQA', { prefill: `Explain ${refLabel(chosen)}` });
  };

  if (!colors) return null;

  const fontSize = FONT_SIZES[fontIdx];
  const prevCh = neighbourChapter(bookId, chapter, -1);
  const nextCh = neighbourChapter(bookId, chapter, 1);

  const Footer = (
    <View style={{ paddingTop: 16 }}>
      {planDay ? (
        <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success, marginBottom: 12 }}>
          <Text style={{ color: colors.success, fontSize: 10, letterSpacing: 1.5, fontFamily: fonts.sansBold }}>
            {plan.label.toUpperCase()} · DAY {dayIndex + 1}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13, marginTop: 4, fontFamily: fonts.sansMedium }}>
            {planNote || `Reading ${readingIndex + 1} of ${planDay.length}`}
          </Text>
          <ProgressBar percent={getProgress(planId)} height={6} style={{ marginTop: 10 }} />
          <TouchableOpacity onPress={goNextPlanReading}
            style={{ marginTop: 12, backgroundColor: colors.success, borderRadius: 10, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: '#fff', fontFamily: fonts.sansBold }}>
              {readingIndex + 1 < planDay.length ? 'Next reading' : (plan.days[dayIndex + 1] ? `Continue to Day ${dayIndex + 2}` : 'Finish')}
            </Text>
            <Ionicons name="arrow-forward" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity disabled={!prevCh} onPress={() => goChapter(-1)}
          style={{ flex: 1, opacity: prevCh ? 1 : 0.4, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
          <Ionicons name="chevron-back" size={16} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: fonts.sans }}>Previous</Text>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansBold }}>{prevCh ? `${prevCh.bookName} ${prevCh.chapter}` : '—'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity disabled={!nextCh} onPress={() => goChapter(1)}
          style={{ flex: 1, opacity: nextCh ? 1 : 0.4, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: fonts.sans }}>Next</Text>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansBold }}>{nextCh ? `${nextCh.bookName} ${nextCh.chapter}` : '—'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.gold} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ParchmentBackground>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={goBack} hitSlop={8}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Chapters', { bookId, bookName })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontFamily: fonts.serifBold }}>{bookName} {chapter}</Text>
          {unlocked ? <Ionicons name="volume-high" size={13} color={colors.gold} /> : <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />}
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setVoiceOpen(true)} hitSlop={6} style={{ paddingHorizontal: 2 }}>
            <Ionicons name="headset-outline" size={18} color={colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeFont(-1)} hitSlop={6} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.serifBold }}>A</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeFont(1)} hitSlop={6} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: fonts.serifBold }}>A</Text>
          </TouchableOpacity>
          <ThemeToggle size={14} />
          <VersionSwitcher compact />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <View style={{ flex: 1, margin: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }}>
          <FlatList
            ref={listRef}
            data={verses}
            keyExtractor={(i) => String(i.num)}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => { try { listRef.current?.scrollToIndex({ index: info.index, animated: true }); } catch {} }, 300);
            }}
            ListHeaderComponent={
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ color: colors.gold, fontSize: 11, letterSpacing: 3, fontFamily: fonts.sansBold }}>{bookName.toUpperCase()}</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 40, fontFamily: fonts.serifBold, lineHeight: 46 }}>{chapter}</Text>
                <TouchableOpacity
                  onPress={() => (playing !== null ? stopSpeech() : verses[0] && onAudio(verses[0].num))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
                >
                  <Ionicons name={playing !== null ? 'stop' : 'play'} size={13} color={colors.gold} />
                  <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.sansBold }}>{playing !== null ? 'Stop' : 'Listen to chapter'}</Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={Footer}
            contentContainerStyle={{ padding: 12, paddingBottom: sel.size > 0 ? 24 : bottomPad }}
            renderItem={({ item }) => {
              const id = `${bookId}-${chapter}-${item.num}`;
              const isSel = sel.has(item.num);
              const isPlay = playing === item.num;
              const isMarked = bookmarkedIds.has(id);
              const hl = HIGHLIGHT_COLORS.find((c) => c.id === highlights[id]);
              const bg = isSel ? colors.verseHighlight
                : flash === item.num ? colors.verseHighlight
                : hl ? (isDark ? hl.dark : hl.light)
                : isPlay ? colors.goldLight : 'transparent';
              return (
                <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 7, paddingHorizontal: 6, backgroundColor: bg, borderRadius: 8, borderWidth: isSel ? 1 : 0, borderColor: colors.verseHighlightBorder, marginBottom: 2 }}>
                  <Text style={{ color: colors.gold, fontSize: Math.max(10, fontSize - 5), width: 22, fontFamily: fonts.sansBold, marginTop: 3 }}>{item.num}</Text>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.7}
                    onPress={() => {
                      const ns = new Set(sel);
                      if (ns.has(item.num)) ns.delete(item.num); else ns.add(item.num);
                      setSel(ns);
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize, lineHeight: Math.round(fontSize * 1.55), fontFamily: fonts.serif }}>{item.text}</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => onAudio(item.num)}
                      hitSlop={6}
                      style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: isPlay ? colors.gold : colors.background2, justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons name={isPlay ? 'stop' : (unlocked ? 'volume-high' : 'headset-outline')} size={12} color={isPlay ? '#fff' : (unlocked ? colors.gold : colors.textSecondary)} />
                    </TouchableOpacity>
                    {isMarked && <Ionicons name="bookmark" size={12} color={colors.gold} />}
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {playing !== null && sel.size === 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Ionicons name="volume-high" size={18} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansBold }}>{bookName} {chapter}:{playing}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.sans }}>
              {(NARRATOR_STYLES.find((x) => x.id === tts?.styleId) || NARRATOR_STYLES[0]).label} narrator · {tts?.speed || 1}×
            </Text>
          </View>
          <TouchableOpacity onPress={() => { stopSpeech(); setVoiceOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="options-outline" size={14} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.sansMedium }}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={stopSpeech} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="stop" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {sel.size > 0 && (
        <View style={{ padding: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 4 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.sansMedium, flex: 1 }}>
              {sel.size} selected · Highlight
            </Text>
            {HIGHLIGHT_COLORS.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => highlightSelected(c.id)} hitSlop={6}
                style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.dot, borderWidth: 2, borderColor: colors.card }} />
            ))}
            <TouchableOpacity onPress={() => highlightSelected(null)} hitSlop={6}
              style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={bookmarkSelected} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: colors.gold }}>
              <Ionicons name="bookmark" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: fonts.sansBold }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={askAI} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: colors.success }}>
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: fonts.sansBold }}>Explain</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareSelected} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: colors.primary }}>
              <Ionicons name="share-social" size={14} color={colors.onPrimary} />
              <Text style={{ color: colors.onPrimary, fontSize: 12, fontFamily: fonts.sansBold }}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSel(new Set())} style={{ paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 }} />
            <Ionicons name="headset" size={30} color={colors.gold} style={{ alignSelf: 'center' }} />
            <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 16, color: colors.textPrimary, fontFamily: fonts.sansBold }}>Unlock Audio Bible for 1 Hour</Text>
            <Text style={{ textAlign: 'center', fontSize: 12, color: colors.textSecondary, marginTop: 6, fontFamily: fonts.sans }}>
              Watch a short ad to listen to Scripture read aloud — choose from several narrator voices, every book and chapter.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setSheet(false)} disabled={unlocking} style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: colors.background2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium }}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={unlock} disabled={unlocking} style={{ flex: 1.4, padding: 13, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: unlocking ? 0.7 : 1 }}>
                {unlocking && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ color: '#fff', fontFamily: fonts.sansBold }}>{unlocking ? 'Loading ad…' : 'Watch ad · Unlock 1h'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <VoiceSheet visible={voiceOpen} onClose={() => setVoiceOpen(false)} onSaved={setTts} />
    </ParchmentBackground>
  );
}
