import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Share, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import ScreenHeader from '../components/ScreenHeader';
import ThemeToggle from '../components/ThemeToggle';
import AIAnswer, { TextSizeButton } from '../components/AIAnswer';
import { useContentBottomPad } from '../components/useContentBottomPad';
import { askBibleQuestion, toPlainText } from '../utils/aiBible';
import { getBookById } from '../data/books';
import { AdManager } from '../ads/AdManager';

const HISTORY_KEY = 'ai_recent_questions_v1';

const STARTERS = [
  { icon: 'book-outline', label: 'Explain a verse', q: 'Explain Jeremiah 29:11' },
  { icon: 'leaf-outline', label: 'Anxiety', q: 'What does the Bible say about anxiety?' },
  { icon: 'person-outline', label: 'Bible people', q: 'Who was Elijah?' },
  { icon: 'library-outline', label: 'Book overview', q: 'What is the book of Romans about?' },
  { icon: 'help-circle-outline', label: 'Big questions', q: 'Why did Jesus die?' },
  { icon: 'heart-outline', label: 'Forgiveness', q: 'How do I forgive someone who hurt me?' },
];

function Thinking({ colors, fonts }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  const [phase, setPhase] = useState(0);
  const phases = ['Reading your question…', 'Searching Scripture…', 'Checking the context…'];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0.3, duration: 320, useNativeDriver: true }),
    ])));
    anims.forEach((a) => a.start());
    const t = setInterval(() => setPhase((p) => (p + 1) % phases.length), 700);
    return () => { anims.forEach((a) => a.stop()); clearInterval(t); };
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {dots.map((d, i) => <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold, opacity: d }} />)}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sansMedium }}>{phases[phase]}</Text>
    </View>
  );
}

export default function AIQAScreen() {
  const { colors, fonts } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const bottomPad = useContentBottomPad(8);
  const [q, setQ] = useState('');
  const [thread, setThread] = useState([]); // [{ id, question, result }]
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const scrollRef = useRef(null);
  const askedPrefill = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((r) => setRecent(JSON.parse(r || '[]'))).catch(() => {});
  }, []);

  useEffect(() => {
    const pre = route.params?.prefill;
    if (pre && askedPrefill.current !== pre) {
      askedPrefill.current = pre;
      ask(pre);
    }
  }, [route.params?.prefill]);

  const remember = async (question) => {
    const next = [question, ...recent.filter((x) => x.toLowerCase() !== question.toLowerCase())].slice(0, 8);
    setRecent(next);
    try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
  };

  const ask = async (text) => {
    const question = String(text ?? q).trim();
    if (!question || loading) return;
    setQ('');
    setLoading(true);
    const id = Date.now();
    setThread((t) => [...t, { id, question, result: null }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    const started = Date.now();
    let result;
    try {
      result = await askBibleQuestion(question);
    } catch (e) {
      result = { title: 'Something went wrong', lead: 'Please try asking again in a moment.', sections: [], followUps: [] };
    }
    // A short, natural "thinking" beat so answers don't pop in jarringly.
    const wait = Math.max(0, 900 - (Date.now() - started));
    setTimeout(() => {
      setThread((t) => t.map((m) => (m.id === id ? { ...m, result } : m)));
      setLoading(false);
      remember(question);
      // Counted as engagement only — the user is about to read the answer,
      // so this is never an interruption point.
      AdManager.tryShowInterstitial({ isNaturalBreak: false });
    }, wait);
  };

  const openVerse = (v) => {
    const book = getBookById(v.bookId);
    if (!book) return;
    navigation.navigate('Verse', { bookId: book.id, bookName: book.name, chapter: v.chapter, highlightVerse: v.verse });
  };

  const share = async (m) => {
    try { await Share.share({ message: `Q: ${m.question}\n\n${toPlainText(m.result)}\n\n— from Bible App` }); } catch {}
  };

  const empty = thread.length === 0;

  return (
    <ParchmentBackground>
      <ScreenHeader
        title="ASK THE BIBLE"
        subtitle="Answers grounded in Scripture"
        onBack={() => navigation.goBack()}
        right={<>
          {thread.length > 0 && (
            <TouchableOpacity onPress={() => setThread([])} hitSlop={8} style={{ justifyContent: 'center' }}>
              <Ionicons name="create-outline" size={19} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <TextSizeButton />
          <ThemeToggle size={14} />
        </>}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          {empty ? (
            <View>
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="sparkles" size={28} color={colors.gold} />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 22, marginTop: 12, fontFamily: fonts.serifBold }}>What’s on your heart?</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19, fontFamily: fonts.sans, paddingHorizontal: 10 }}>
                  Ask about any verse, book, person or life question. Every answer quotes the actual text of Scripture with its reference.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 6 }}>
                {STARTERS.map((s) => (
                  <TouchableOpacity key={s.label} onPress={() => ask(s.q)}
                    style={{ width: '48.5%', padding: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                    <Ionicons name={s.icon} size={18} color={colors.gold} />
                    <Text style={{ color: colors.textPrimary, fontSize: 13, marginTop: 6, fontFamily: fonts.sansBold }}>{s.label}</Text>
                    <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 11.5, marginTop: 2, fontFamily: fonts.sans }}>{s.q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {recent.length > 0 && (
                <View style={{ marginTop: 18 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, fontFamily: fonts.sansBold }}>RECENT</Text>
                  {recent.map((r) => (
                    <TouchableOpacity key={r} onPress={() => ask(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 }}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sans }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            thread.map((m, i) => (
              <View key={m.id} style={{ marginBottom: 18 }}>
                <View style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: colors.primary, borderRadius: 18, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 14 }}>
                  <Text style={{ color: colors.onPrimary, fontSize: 14, lineHeight: 20, fontFamily: fonts.sansMedium }}>{m.question}</Text>
                </View>
                <View style={{ marginTop: 12 }}>
                  {m.result ? (
                    <View style={{ backgroundColor: colors.card, borderRadius: 18, borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
                      <AIAnswer
                        result={m.result}
                        animate={i === thread.length - 1}
                        onOpenVerse={openVerse}
                        onFollowUp={(f) => ask(f)}
                        footer={
                          <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                            <TouchableOpacity onPress={() => share(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="share-social-outline" size={15} color={colors.textSecondary} />
                              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sansMedium }}>Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('Sermon', { prefill: m.question })} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="mic-outline" size={15} color={colors.textSecondary} />
                              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sansMedium }}>Turn into a sermon</Text>
                            </TouchableOpacity>
                          </View>
                        }
                      />
                    </View>
                  ) : (
                    <Thinking colors={colors} fonts={fonts} />
                  )}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 8 }} />
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: bottomPad, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 14, justifyContent: 'center' }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Ask about a verse, topic or person…"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{ color: colors.textPrimary, fontFamily: fonts.sans, fontSize: 14, paddingVertical: 10 }}
              onSubmitEditing={() => ask()}
              blurOnSubmit
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity onPress={() => ask()} disabled={!q.trim() || loading}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: q.trim() && !loading ? colors.gold : colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ParchmentBackground>
  );
}
