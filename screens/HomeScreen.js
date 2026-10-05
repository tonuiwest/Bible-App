import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { usePlanner } from '../context/PlannerContext';
import ParchmentBackground from '../components/ParchmentBackground';
import VersionSwitcher from '../components/VersionSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import ProgressBar from '../components/ProgressBar';
import { getVerseOfTheDay } from '../data/bibleData';
import { getBookById } from '../data/books';
import { getLastRead, getStreak } from '../utils/storage';
import { AdManager } from '../ads/AdManager';
import ReminderSheet from '../components/ReminderSheet';
import { getReminder, formatReminderTime } from '../utils/reminders';

const FALLBACK_VERSE = { bookId: 'psa', bookName: 'Psalms', chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.', ref: 'Psalms 23:1' };


export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useTheme();
  const { activePlans, getProgress, getDoneCount, nextDayIndex } = usePlanner();
  const [daily, setDaily] = useState(FALLBACK_VERSE);
  const [lastRead, setLastRead] = useState(null);
  const [streak, setStreak] = useState({ count: 0, best: 0, readToday: false });
  const [votdSaved, setVotdSaved] = useState(false);
  const [reminder, setReminder] = useState(null);
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVerseOfTheDay().then((v) => { if (!cancelled && v) setDaily(v); });
    return () => { cancelled = true; };
  }, []);

  // Refresh personal stats whenever Home comes back into view.
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const [lr, st, bm, rem] = await Promise.all([getLastRead(), getStreak(), AsyncStorage.getItem('bookmarks'), getReminder()]);
      if (!alive) return;
      setReminder(rem);
      setLastRead(lr);
      setStreak(st);
      const list = JSON.parse(bm || '[]');
      setVotdSaved(list.some((b) => b.id === `${daily.bookId}-${daily.chapter}-${daily.verse}`));
    })();
    return () => { alive = false; };
  }, [daily]));

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const greetIcon = hour < 12 ? 'partly-sunny' : hour < 18 ? 'sunny' : 'moon';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  const plan = activePlans[0];

  const shareVotd = async () => {
    try {
      await Share.share({ message: `“${daily.text}”\n— ${daily.ref} (KJV)\n\nVerse of the Day` });
    } catch {}
  };

  const saveVotd = async () => {
    const id = `${daily.bookId}-${daily.chapter}-${daily.verse}`;
    const list = JSON.parse((await AsyncStorage.getItem('bookmarks')) || '[]');
    const exists = list.some((b) => b.id === id);
    const next = exists ? list.filter((b) => b.id !== id)
      : [...list, { id, bookId: daily.bookId, bookName: daily.bookName, chapter: daily.chapter, verse: daily.verse, text: daily.text, createdAt: Date.now() }];
    await AsyncStorage.setItem('bookmarks', JSON.stringify(next));
    setVotdSaved(!exists);
  };

  const continueTarget = lastRead
    ? { bookId: lastRead.bookId, bookName: lastRead.bookName || getBookById(lastRead.bookId)?.name, chapter: lastRead.chapter }
    : { bookId: 'gen', bookName: 'Genesis', chapter: 1 };

  if (!colors) return null;

  const Pill = ({ icon, label, onPress, active }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(233,216,180,0.22)' }}>
      <Ionicons name={icon} size={13} color={active ? '#F2D48C' : '#F3E9D6'} />
      <Text style={{ color: '#F3E9D6', fontSize: 11.5, fontFamily: fonts.sansSemi }}>{label}</Text>
    </TouchableOpacity>
  );

  const Row = ({ icon, iconColor, iconBg, kicker, title, right, onPress, children, last }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={{ paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.sansMedium }}>{kicker}</Text>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 16, fontFamily: fonts.serifBold }}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </TouchableOpacity>
  );

  return (
    <ParchmentBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 36, gap: 12 }}
      >
        {/* ---------- Header: greeting on its own line, title + controls below ---------- */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={greetIcon} size={12} color={colors.gold} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, color: colors.textSecondary, fontFamily: fonts.sansMedium }}>
              <Text style={{ color: colors.gold, fontFamily: fonts.sansBold }}>{greet}</Text>  ·  {today}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontSize: 27, color: colors.textPrimary, fontFamily: fonts.serifBold, lineHeight: 33 }}>
              The Holy Bible
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginLeft: 8 }}>
              <ThemeToggle size={15} />
              <VersionSwitcher />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.gold, fontSize: 9 }}>✦</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
        </View>

        {/* ---------- Verse of the day (leather-bound card) ---------- */}
        <LinearGradient
          colors={[colors.heroStart, colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, paddingTop: 13, paddingBottom: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(201,168,106,0.35)' }}
        >
          <Text style={{ fontSize: 10, letterSpacing: 2.5, color: '#E9D8B4', fontFamily: fonts.sansBold }}>VERSE OF THE DAY</Text>
          <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 17, color: '#FFFDF7', lineHeight: 24, marginTop: 7, fontFamily: fonts.serif }}>
            “{daily.text}”
          </Text>
          <Text style={{ fontSize: 12, color: '#F2D48C', marginTop: 6, fontFamily: fonts.sansBold }}>{daily.ref} · KJV</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 11 }}>
            <Pill icon="book-outline" label="Read" onPress={() => navigation.navigate('Verse', { bookId: daily.bookId, bookName: daily.bookName, chapter: daily.chapter, highlightVerse: daily.verse })} />
            <Pill icon="sparkles-outline" label="Explain" onPress={() => navigation.navigate('AIQA', { prefill: `Explain ${daily.ref}` })} />
            <Pill icon={votdSaved ? 'bookmark' : 'bookmark-outline'} label={votdSaved ? 'Saved' : 'Save'} active={votdSaved} onPress={saveVotd} />
            <Pill icon="share-social-outline" label="Share" onPress={shareVotd} />
          </View>
        </LinearGradient>

        {/* ---------- Today: reading, plan, reminder in one paper card ---------- */}
        <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 10, letterSpacing: 2.2, color: colors.gold, fontFamily: fonts.sansBold }}>TODAY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, backgroundColor: colors.background2 }}>
              <Ionicons name="flame" size={12} color="#E8823A" />
              <Text style={{ color: colors.textPrimary, fontSize: 11, fontFamily: fonts.sansBold }}>
                {streak.count} day{streak.count === 1 ? '' : 's'} streak
              </Text>
            </View>
          </View>

          <Row
            icon="book" iconColor={colors.gold} iconBg={colors.goldLight}
            kicker={lastRead ? 'Continue reading' : 'Start reading'}
            title={`${continueTarget.bookName} ${continueTarget.chapter}`}
            onPress={() => navigation.navigate('Verse', continueTarget)}
            right={<Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
          />

          <Row
            icon={plan ? plan.icon : 'calendar-outline'} iconColor={colors.success} iconBg={colors.successLight}
            kicker={plan ? `Reading plan · Day ${nextDayIndex(plan.id) + 1} of ${plan.days.length} · ${getDoneCount(plan.id)} done` : 'Reading plans'}
            title={plan ? plan.label : 'Choose a plan or make your own'}
            onPress={() => (plan ? navigation.navigate('PlannerDetail', { topicId: plan.id }) : navigation.navigate('Planner'))}
            right={plan
              ? <Text style={{ color: colors.success, fontSize: 13, fontFamily: fonts.sansBold }}>{getProgress(plan.id)}%</Text>
              : <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
          >
            {plan ? (
              <View style={{ marginTop: 6, marginLeft: 46 }}>
                <ProgressBar percent={getProgress(plan.id)} height={6} />
              </View>
            ) : null}
          </Row>

          <Row
            last
            icon={reminder?.enabled ? 'notifications' : 'notifications-outline'} iconColor={colors.gold} iconBg={colors.goldLight}
            kicker="Daily reminder"
            title={reminder?.enabled ? `Every day at ${formatReminderTime(reminder)}` : 'Not set yet'}
            onPress={() => setReminderOpen(true)}
            right={<Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.sansBold }}>{reminder?.enabled ? 'Change' : 'Turn on'}</Text>}
          />
        </View>

        {/* ---------- Tools that aren't in the bottom bar ---------- */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            { key: 'Search', icon: 'search', title: 'Search', sub: 'Find any word or verse' },
            { key: 'Sermon', icon: 'mic-outline', title: 'Sermon Writer', sub: 'Outlines & full sermons' },
          ].map((t) => (
            <TouchableOpacity key={t.key} onPress={() => navigation.navigate(t.key)} activeOpacity={0.75}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={t.icon} size={16} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.serifBold }}>{t.title}</Text>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 10.5, marginTop: 1, fontFamily: fonts.sans }}>{t.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {AdManager.isPrivacyOptionsRequired() ? (
          <TouchableOpacity onPress={() => AdManager.showPrivacyOptions()} style={{ alignSelf: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, textDecorationLine: 'underline', fontFamily: fonts.sans }}>Privacy choices</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      <ReminderSheet visible={reminderOpen} onClose={() => setReminderOpen(false)} onChanged={setReminder} />
    </ParchmentBackground>
  );
}
