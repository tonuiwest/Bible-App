import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Share, Alert, Modal } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import VersionSwitcher from '../components/VersionSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVersion } from '../context/VersionContext';
import { usePlanner } from '../context/PlannerContext';
import { getChapter } from '../data/bibleData';
import { AdManager } from '../ads/AdManager';
import * as Speech from 'expo-speech';

const BOOKMARKS_KEY = 'bookmarks';

export default function VerseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useTheme();
  const { version } = useVersion();
  const { addProgress } = usePlanner();
  const bottomPad = useContentBottomPad();
  const p = route.params || {};
  const bookId = p.bookId || 'gen';
  const bookName = p.bookName || 'Genesis';
  const chapter = p.chapter || 1;
  const planId = p.planId;
  const dayIndex = p.dayIndex;

  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [unlocked, setUnlocked] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [pending, setPending] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const refreshUnlockState = useCallback(async () => {
    const ok = await AdManager.isAudioUnlocked();
    setUnlocked(ok);
    return ok;
  }, []);

  // The audio-unlock key is global (see ads/AdManager.js), so re-check every
  // time this screen gains focus — unlocking from any chapter now correctly
  // reflects here immediately too, without needing a remount.
  useFocusEffect(useCallback(() => { refreshUnlockState(); }, [refreshUnlockState]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const c = await getChapter(bookId, chapter, version || 'kjv');
      if (cancelled) return;
      const arr = Object.entries(c)
        .map(([n, t]) => ({ num: parseInt(n, 10), text: String(t).trim() }))
        .sort((a, b) => a.num - b.num);
      setVerses(arr);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookId, chapter, version]);

  // Reading Plans track progress automatically: opening a plan's reading
  // marks that day done (once the chapter has actually loaded), no manual
  // step required. The Mark Complete button in Plan Detail still exists for
  // manual corrections, but this is the primary way progress is tracked.
  useEffect(() => {
    if (loading || planId == null || dayIndex == null) return;
    (async () => {
      const result = await addProgress(planId, dayIndex);
      if (result?.completedPlan) {
        Alert.alert('Reading Plan Complete! 🎉', "Nice work finishing this reading plan. Head back to Reading Plans to restart it whenever you're ready.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, planId, dayIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
      const list = JSON.parse(raw || '[]');
      if (!cancelled) setBookmarkedIds(new Set(list.map(b => b.id)));
    })();
    return () => { cancelled = true; };
  }, [bookId, chapter]);

  // Stop any in-progress speech the moment this screen goes away (back nav,
  // switching chapters, app backgrounding) — leaving speech running past
  // unmount is what led to native TTS state piling up over a long session.
  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  // Occasional, non-disruptive interstitial: only fires here, at the natural
  // break of leaving a chapter, and is still capped by AdManager's cooldown.
  const goBack = () => {
    Speech.stop();
    AdManager.tryShowInterstitial({ isNaturalBreak: true });
    navigation.goBack();
  };

  const onAudio = async (num) => {
    const ok = await refreshUnlockState();
    if (!ok) { setPending(num); setSheet(true); return; }
    play(num);
  };

  const play = (num) => {
    const verse = verses.find(v => v.num === num);
    if (!verse) return;
    if (playing !== null) {
      Speech.stop();
      if (playing === num) { setPlaying(null); return; }
    }
    setPlaying(num);
    Speech.speak(verse.text, {
      onDone: () => setPlaying(null),
      onStopped: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
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
        "No ad was available just then. This is usually temporary — tap Retry to try again right away.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: unlock },
        ]
      );
    }
  };

  const toggleBookmark = async (verse) => {
    const id = `${bookId}-${chapter}-${verse.num}`;
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    const list = JSON.parse(raw || '[]');
    const exists = list.some(b => b.id === id);
    const next = exists
      ? list.filter(b => b.id !== id)
      : [...list, { id, bookId, bookName, chapter, verse: verse.num, text: verse.text, createdAt: Date.now() }];
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    setBookmarkedIds(new Set(next.map(b => b.id)));
  };

  const shareSelected = async () => {
    const chosen = verses.filter(v => sel.has(v.num));
    if (!chosen.length) return;
    const text = chosen.map(v => `${v.num} ${v.text}`).join('\n') + `\n\n${bookName} ${chapter}`;
    try {
      const result = await Share.share({ message: text });
      // Sharing is a natural completion point — a good, occasional spot for
      // an interstitial, same as leaving a chapter. Skip it if the person
      // just cancelled the share sheet (iOS reports this; Android doesn't
      // reliably, so this is a best-effort check, not a hard requirement).
      if (result?.action !== Share.dismissedAction) {
        AdManager.tryShowInterstitial({ isNaturalBreak: true });
      }
    } catch {}
  };

  const bookmarkSelected = async () => {
    const chosen = verses.filter(v => sel.has(v.num));
    for (const v of chosen) {
      const id = `${bookId}-${chapter}-${v.num}`;
      if (!bookmarkedIds.has(id)) await toggleBookmark(v);
    }
    setSel(new Set());
  };

  if (!colors) return null;
  if (loading) {
    return (
      <ParchmentBackground>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </ParchmentBackground>
    );
  }

  return (
    <ParchmentBackground>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={goBack} hitSlop={8}><Ionicons name="arrow-back" size={18} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.serifBold }}>
          {bookName.toUpperCase()} {chapter} {unlocked ? '🔊' : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ThemeToggle size={14} />
          <VersionSwitcher compact />
        </View>
      </View>

      <View style={{ flex: 1, margin: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
        <FlatList
          data={verses}
          keyExtractor={i => String(i.num)}
          contentContainerStyle={{ padding: 12, paddingBottom: sel.size > 0 ? 20 : bottomPad }}
          renderItem={({ item }) => {
            const isSel = sel.has(item.num);
            const isPlay = playing === item.num;
            const isMarked = bookmarkedIds.has(`${bookId}-${chapter}-${item.num}`);
            return (
              <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 6, backgroundColor: isSel ? colors.verseHighlight : 'transparent', borderRadius: 8, borderWidth: isSel ? 1 : 0, borderColor: colors.verseHighlightBorder }}>
                <Text style={{ color: colors.gold, fontSize: 11, width: 18, fontWeight: '700' }}>{item.num}</Text>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => {
                    const ns = new Set(sel);
                    if (ns.has(item.num)) ns.delete(item.num); else ns.add(item.num);
                    setSel(ns);
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24, fontFamily: fonts.serif }}>{item.text}</Text>
                </TouchableOpacity>
                {isMarked && <Ionicons name="bookmark" size={12} color={colors.gold} style={{ marginTop: 3 }} />}
                <TouchableOpacity
                  onPress={() => onAudio(item.num)}
                  hitSlop={6}
                  style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: isPlay ? colors.gold : colors.background2, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons name={isPlay ? 'stop' : (unlocked ? 'volume-high' : 'headset-outline')} size={11} color={isPlay ? '#fff' : (unlocked ? colors.gold : colors.textSecondary)} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>

      {sel.size > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, padding: 10, paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity onPress={bookmarkSelected} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: colors.gold }}>
            <Ionicons name="bookmark" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Bookmark</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareSelected} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: colors.primary }}>
            <Ionicons name="share-outline" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSel(new Set())} style={{ paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 10 }} />
            <Ionicons name="headset" size={28} color={colors.gold} style={{ alignSelf: 'center' }} />
            <Text style={{ textAlign: 'center', marginTop: 8, fontWeight: '700', color: colors.textPrimary }}>Unlock Audio for 1 Hour</Text>
            <Text style={{ textAlign: 'center', fontSize: 11, color: colors.textSecondary, marginTop: 6 }}>Verse {pending} — watch a short ad to unlock audio reading everywhere in the app.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity onPress={() => setSheet(false)} disabled={unlocking} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.background2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ color: colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={unlock} disabled={unlocking} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: unlocking ? 0.7 : 1 }}>
                {unlocking && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ color: '#fff', fontWeight: '700' }}>{unlocking ? 'Loading ad…' : 'Watch Ad — Unlock 1h'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PersistentBanner />
    </ParchmentBackground>
  );
}
