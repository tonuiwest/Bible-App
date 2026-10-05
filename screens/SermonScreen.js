import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Share, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import ScreenHeader from '../components/ScreenHeader';
import ThemeToggle from '../components/ThemeToggle';
import AIAnswer from '../components/AIAnswer';
import { useContentBottomPad } from '../components/useContentBottomPad';
import { generateSermon, toPlainText } from '../utils/aiBible';
import { getBookById } from '../data/books';
import { AdManager } from '../ads/AdManager';

const SAVED_KEY = 'saved_sermons_v1';
const UNLOCK_KEY = '@sermon_unlock_until';
const UNLOCK_MS = 20 * 60 * 1000; // one rewarded watch unlocks full sermons for 20 minutes

const STYLES = [
  { id: 'topical', label: 'Topical', icon: 'pricetags-outline' },
  { id: 'expository', label: 'Expository', icon: 'reader-outline' },
  { id: 'evangelistic', label: 'Evangelistic', icon: 'megaphone-outline' },
];
const LENGTHS = [
  { id: 'short', label: 'Short', sub: '10–15 min' },
  { id: 'standard', label: 'Standard', sub: '25–30 min' },
  { id: 'extended', label: 'Extended', sub: '35–45 min' },
];
const AUDIENCES = [
  { id: 'general', label: 'Congregation' },
  { id: 'youth', label: 'Youth' },
  { id: 'smallgroup', label: 'Small group' },
];
const IDEAS = ['Finding peace in anxiety', 'Psalm 23', 'The power of forgiveness', 'Romans 8:28-39', 'Faith that endures', 'John 3:16', 'Hope in hard times', 'The prodigal son'];

function Chip({ on, label, sub, icon, onPress, colors, fonts }) {
  return (
    <TouchableOpacity onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.goldLight : colors.background }}>
      {icon ? <Ionicons name={icon} size={15} color={on ? colors.gold : colors.textSecondary} /> : null}
      <Text style={{ color: on ? colors.textPrimary : colors.textSecondary, fontSize: 12, marginTop: icon ? 3 : 0, fontFamily: on ? fonts.sansBold : fonts.sansMedium }}>{label}</Text>
      {sub ? <Text style={{ color: colors.textSecondary, fontSize: 9.5, marginTop: 1, fontFamily: fonts.sans }}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

export default function SermonScreen() {
  const { colors, fonts } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const bottomPad = useContentBottomPad(20);
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('topical');
  const [length, setLength] = useState('standard');
  const [audience, setAudience] = useState('general');
  const [loading, setLoading] = useState(false);
  const [sermon, setSermon] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [gate, setGate] = useState(false);
  const [watching, setWatching] = useState(false);
  const [saved, setSaved] = useState([]);
  const scrollRef = useRef(null);

  const refreshUnlock = async () => {
    try {
      const until = parseInt((await AsyncStorage.getItem(UNLOCK_KEY)) || '0', 10);
      const ok = Date.now() < until;
      setUnlocked(ok);
      return ok;
    } catch { return false; }
  };

  useFocusEffect(useCallback(() => {
    refreshUnlock();
    AsyncStorage.getItem(SAVED_KEY).then((r) => setSaved(JSON.parse(r || '[]'))).catch(() => {});
  }, []));

  useEffect(() => {
    if (route.params?.prefill) setTopic(String(route.params.prefill).replace(/\?$/, ''));
  }, [route.params?.prefill]);

  const generate = async (input) => {
    const text = String(input ?? topic).trim();
    if (!text || loading) return;
    setTopic(text);
    setLoading(true);
    setSermon(null);
    const started = Date.now();
    let res;
    try {
      res = await generateSermon({ input: text, style, length, audience });
    } catch (e) {
      res = null;
    }
    const wait = Math.max(0, 1400 - (Date.now() - started));
    setTimeout(async () => {
      setLoading(false);
      if (!res) { Alert.alert('Could not write that sermon', 'Please try a different topic or passage.'); return; }
      setSermon({ ...res, input: text, style, length, audience, createdAt: Date.now() });
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
      const ok = await refreshUnlock();
      if (!ok) setGate(true);
    }, wait);
  };

  // Rewarded interstitial: the user opts in on our intro sheet first
  // (required for this format). If no ad is available, they still get the
  // sermon — no-fill never blocks the feature.
  const watchToUnlock = async () => {
    setWatching(true);
    const { shown, earned } = await AdManager.showRewardedInterstitial();
    setWatching(false);
    if (earned || !shown) {
      try { await AsyncStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_MS)); } catch {}
      setUnlocked(true);
      setGate(false);
    } else {
      setGate(false); // dismissed early — the outline stays visible with an unlock button
    }
  };

  const saveSermon = async () => {
    if (!sermon) return;
    const entry = { id: String(sermon.createdAt), title: sermon.title, input: sermon.input, lead: sermon.lead, createdAt: sermon.createdAt, data: sermon };
    const next = [entry, ...saved.filter((s) => s.id !== entry.id)].slice(0, 30);
    setSaved(next);
    try { await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
    Alert.alert('Saved', 'You can find this sermon under “My sermons”.');
  };

  const deleteSaved = async (id) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    try { await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
  };

  const shareSermon = async () => {
    if (!sermon) return;
    try { await Share.share({ message: `${toPlainText(sermon)}\n\n— written with Bible App` }); } catch {}
  };

  const openVerse = (v) => {
    const book = getBookById(v.bookId);
    if (!book) return;
    navigation.navigate('Verse', { bookId: book.id, bookName: book.name, chapter: v.chapter, highlightVerse: v.verse });
  };

  const locked = !!sermon && !unlocked;
  const isSaved = sermon && saved.some((s) => s.id === String(sermon.createdAt));

  return (
    <ParchmentBackground>
      <ScreenHeader title="SERMON WRITER" subtitle="Biblically grounded, ready to preach" onBack={() => navigation.goBack()} right={<ThemeToggle size={14} />} />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
        {!sermon && !loading && (
          <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1.5, fontFamily: fonts.sansBold }}>TOPIC OR PASSAGE</Text>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder="e.g. Finding peace in anxiety  ·  Romans 8:28-39"
              placeholderTextColor={colors.textSecondary}
              style={{ marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: colors.textPrimary, backgroundColor: colors.background, fontFamily: fonts.sans, fontSize: 14 }}
              returnKeyType="go"
              onSubmitEditing={() => generate()}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
              {IDEAS.map((i) => (
                <TouchableOpacity key={i} onPress={() => setTopic(i)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.background2 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 11.5, fontFamily: fonts.sansMedium }}>{i}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1.5, marginTop: 16, marginBottom: 8, fontFamily: fonts.sansBold }}>STYLE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {STYLES.map((s) => <Chip key={s.id} on={style === s.id} label={s.label} icon={s.icon} onPress={() => setStyle(s.id)} colors={colors} fonts={fonts} />)}
            </View>
            <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1.5, marginTop: 14, marginBottom: 8, fontFamily: fonts.sansBold }}>LENGTH</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {LENGTHS.map((s) => <Chip key={s.id} on={length === s.id} label={s.label} sub={s.sub} onPress={() => setLength(s.id)} colors={colors} fonts={fonts} />)}
            </View>
            <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1.5, marginTop: 14, marginBottom: 8, fontFamily: fonts.sansBold }}>AUDIENCE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {AUDIENCES.map((s) => <Chip key={s.id} on={audience === s.id} label={s.label} onPress={() => setAudience(s.id)} colors={colors} fonts={fonts} />)}
            </View>

            <TouchableOpacity onPress={() => generate()} disabled={!topic.trim()}
              style={{ marginTop: 18, paddingVertical: 15, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: topic.trim() ? colors.primary : colors.border }}>
              <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
              <Text style={{ color: colors.onPrimary, fontSize: 15, fontFamily: fonts.sansBold }}>Write my sermon</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={{ color: colors.textPrimary, marginTop: 14, fontSize: 15, fontFamily: fonts.serifBold }}>Preparing your sermon…</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 12, fontFamily: fonts.sans }}>Studying the text, outlining points and gathering illustrations</Text>
          </View>
        )}

        {sermon && !loading && (
          <View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity onPress={() => setSermon(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                <Ionicons name="add" size={14} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.sansMedium }}>New</Text>
              </TouchableOpacity>
              {!locked && (
                <>
                  <TouchableOpacity onPress={saveSermon} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                    <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={14} color={colors.gold} />
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.sansMedium }}>{isSaved ? 'Saved' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={shareSermon} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                    <Ionicons name="share-social-outline" size={14} color={colors.textPrimary} />
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.sansMedium }}>Share</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18 }}>
              <AIAnswer
                result={sermon}
                onOpenVerse={openVerse}
                locked={locked}
                footer={locked ? (
                  <View style={{ marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: colors.goldLight, alignItems: 'center' }}>
                    <View style={{ alignSelf: 'stretch', marginBottom: 12 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1.5, marginBottom: 6, fontFamily: fonts.sansBold }}>OUTLINE</Text>
                      {sermon.sections.filter((s) => /^(I|II|III|IV|V)\. /.test(s.heading)).map((s) => (
                        <Text key={s.heading} style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 22, fontFamily: fonts.serifSemi }}>{s.heading}</Text>
                      ))}
                    </View>
                    <Ionicons name="lock-closed" size={20} color={colors.gold} />
                    <Text style={{ color: colors.textPrimary, marginTop: 6, fontSize: 14, textAlign: 'center', fontFamily: fonts.sansBold }}>
                      {sermon.sections.length - 3} more sections: introduction, every point with illustrations, gospel connection, conclusion, prayer and questions
                    </Text>
                    <TouchableOpacity onPress={() => setGate(true)} style={{ marginTop: 12, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.gold }}>
                      <Text style={{ color: '#fff', fontFamily: fonts.sansBold }}>Unlock full sermon</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              />
            </View>
          </View>
        )}

        {!sermon && !loading && saved.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, fontFamily: fonts.sansBold }}>MY SERMONS</Text>
            {saved.map((s) => (
              <TouchableOpacity key={s.id} onPress={() => { setSermon(s.data); refreshUnlock().then((ok) => { if (!ok) setUnlocked(true); }); }}
                onLongPress={() => Alert.alert('Delete sermon?', s.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteSaved(s.id) }])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="document-text-outline" size={20} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 13 }}>{s.title}</Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 11, marginTop: 2 }}>{s.lead}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={gate} transparent animationType="slide" onRequestClose={() => setGate(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 }} />
            <View style={{ alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="gift-outline" size={26} color={colors.gold} />
            </View>
            <Text style={{ textAlign: 'center', color: colors.textPrimary, fontSize: 18, marginTop: 10, fontFamily: fonts.serifBold }}>Your sermon is ready</Text>
            <Text style={{ textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 19, fontFamily: fonts.sans }}>
              Watch a short video ad to unlock the full manuscript — and every sermon you write for the next 20 minutes.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity onPress={() => setGate(false)} disabled={watching}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium }}>Just the outline</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={watchToUnlock} disabled={watching}
                style={{ flex: 1.3, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                {watching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="play" size={14} color="#fff" />}
                <Text style={{ color: '#fff', fontFamily: fonts.sansBold }}>{watching ? 'Loading…' : 'Watch & unlock'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ParchmentBackground>
  );
}
