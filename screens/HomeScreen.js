import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useVersion } from '../context/VersionContext';
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

const ACTIONS = [
  { key: 'Books', label: 'Library', sub: '66 books', icon: 'library', tint: '#C9A86A' },
  { key: 'Search', label: 'Search', sub: 'Any word', icon: 'search', tint: '#5AA0E6' },
  { key: 'Planner', label: 'Plans', sub: 'Daily reading', icon: 'calendar', tint: '#2E9E5B' },
  { key: 'AIQA', label: 'Ask AI', sub: 'Bible answers', icon: 'sparkles', tint: '#8E6CD8' },
  { key: 'Sermon', label: 'Sermons', sub: 'AI writer', icon: 'mic', tint: '#D9774B' },
  { key: 'Bookmarks', label: 'Saved', sub: 'Your verses', icon: 'bookmark', tint: '#EB7896' },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useTheme();
  const { version, versions } = useVersion();
  const { activePlans, getProgress, getDoneCount, nextDayIndex } = usePlanner();
  const [daily, setDaily] = useState(FALLBACK_VERSE);
  const [lastRead, setLastRead] = useState(null);
  const [streak, setStreak] = useState({ count: 0, best: 0, readToday: false });
  const [savedCount, setSavedCount] = useState(0);
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
      setSavedCount(list.length);
      setVotdSaved(list.some((b) => b.id === `${daily.bookId}-${daily.chapter}-${daily.verse}`));
    })();
    return () => { alive = false; };
  }, [daily]));

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const greetIcon = hour < 12 ? 'partly-sunny' : hour < 18 ? 'sunny' : 'moon';
  const curVer = versions && versions.find((v) => v.id === version);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
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
    setSavedCount(next.length);
  };

  const continueTarget = lastRead
    ? { bookId: lastRead.bookId, bookName: lastRead.bookName || getBookById(lastRead.bookId)?.name, chapter: lastRead.chapter }
    : { bookId: 'gen', bookName: 'Genesis', chapter: 1 };

  if (!colors) return null;

  const IconBtn = ({ icon, label, onPress, active }) => (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)' }}>
      <Ionicons name={icon} size={14} color={active ? '#F2D48C' : '#FFFFFF'} />
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontFamily: fonts.sansSemi }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ParchmentBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-between', // spreads sections evenly on tall screens
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 34,
          gap: 14,
        }}
      >
        {/* ---------- Header ---------- */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name={greetIcon} size={14} color={colors.gold} />
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary, fontFamily: fonts.sansMedium }}>{greet} · {today}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setReminderOpen(true)} hitSlop={6}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={reminder?.enabled ? 'notifications' : 'notifications-outline'} size={16} color={colors.gold} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Search')} hitSlop={6}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="search" size={16} color={colors.gold} />
              </TouchableOpacity>
              <ThemeToggle />
              <VersionSwitcher />
            </View>
          </View>
          <Text style={{ fontSize: 32, color: colors.textPrimary, fontFamily: fonts.serifBold, marginTop: 6, lineHeight: 38 }}>
            The Holy Bible
          </Text>
        </View>

        {/* ---------- Verse of the day ---------- */}
        <LinearGradient
          colors={[colors.heroStart, colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 22, paddingVertical: 20, paddingHorizontal: 18 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 10, letterSpacing: 2.5, color: '#E9D8B4', fontFamily: fonts.sansBold }}>VERSE OF THE DAY</Text>
            <Ionicons name="sunny-outline" size={16} color="#E9D8B4" />
          </View>
          <Text
            numberOfLines={6}
            style={{ fontSize: 19, color: '#FFFDF7', lineHeight: 28, marginTop: 12, fontFamily: fonts.serif }}
          >
            “{daily.text}”
          </Text>
          <Text style={{ fontSize: 13, color: '#F2D48C', marginTop: 10, fontFamily: fonts.sansBold }}>
            {daily.ref} · {curVer ? curVer.short : 'KJV'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <IconBtn icon="book-outline" label="Read" onPress={() => navigation.navigate('Verse', { bookId: daily.bookId, bookName: daily.bookName, chapter: daily.chapter, highlightVerse: daily.verse })} />
            <IconBtn icon="sparkles-outline" label="Explain" onPress={() => navigation.navigate('AIQA', { prefill: `Explain ${daily.ref}` })} />
            <IconBtn icon={votdSaved ? 'bookmark' : 'bookmark-outline'} label={votdSaved ? 'Saved' : 'Save'} active={votdSaved} onPress={saveVotd} />
            <IconBtn icon="share-social-outline" label="Share" onPress={shareVotd} />
          </View>
        </LinearGradient>

        {/* ---------- Stats ---------- */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { icon: 'flame', tint: '#E8823A', value: streak.count, label: streak.count === 1 ? 'day streak' : 'day streak' },
            { icon: 'calendar', tint: colors.success, value: activePlans.length, label: activePlans.length === 1 ? 'active plan' : 'active plans' },
            { icon: 'bookmark', tint: '#EB7896', value: savedCount, label: 'saved verses' },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' }}>
              <Ionicons name={s.icon} size={18} color={s.tint} />
              <Text style={{ fontSize: 20, color: colors.textPrimary, fontFamily: fonts.sansBold, marginTop: 4 }}>{s.value}</Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontFamily: fonts.sansMedium }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ---------- Continue reading + plan ---------- */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Verse', continueTarget)}
            style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="book" size={20} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.sansMedium }}>{lastRead ? 'Continue reading' : 'Start reading'}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: fonts.serifBold, marginTop: 1 }}>
                {continueTarget.bookName} {continueTarget.chapter}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 1, fontFamily: fonts.sans }}>{curVer ? curVer.label : 'King James Version'}</Text>
            </View>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => plan ? navigation.navigate('PlannerDetail', { topicId: plan.id }) : navigation.navigate('Planner')}
            style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={plan ? plan.icon : 'calendar-outline'} size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.sansMedium }}>{plan ? `Today · Day ${nextDayIndex(plan.id) + 1} of ${plan.days.length}` : 'Reading plans'}</Text>
                <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 16, fontFamily: fonts.serifBold, marginTop: 1 }}>
                  {plan ? plan.label : 'Start a plan or create your own'}
                </Text>
              </View>
              <Text style={{ color: colors.success, fontSize: 13, fontFamily: fonts.sansBold }}>{plan ? `${getProgress(plan.id)}%` : ''}</Text>
              {!plan && <Ionicons name="chevron-forward" size={16} color={colors.success} />}
            </View>
            {plan ? (
              <>
                <ProgressBar percent={getProgress(plan.id)} height={8} style={{ marginTop: 12 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 6, fontFamily: fonts.sans }}>{getDoneCount(plan.id)} of {plan.days.length} days complete</Text>
              </>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* ---------- Daily reminder ---------- */}
        <TouchableOpacity
          onPress={() => setReminderOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: reminder?.enabled ? colors.border : colors.gold, borderStyle: reminder?.enabled ? 'solid' : 'dashed', backgroundColor: colors.card }}
        >
          <Ionicons name={reminder?.enabled ? 'notifications' : 'notifications-outline'} size={18} color={colors.gold} />
          <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansMedium }}>
            {reminder?.enabled ? `Daily reminder at ${formatReminderTime(reminder)}` : 'Set a daily reading reminder'}
          </Text>
          <Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.sansBold }}>{reminder?.enabled ? 'Change' : 'Turn on'}</Text>
        </TouchableOpacity>

        {/* ---------- Quick actions ---------- */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.key}
              onPress={() => navigation.navigate(a.key)}
              style={{ width: '31.5%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: a.tint + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={a.icon} size={19} color={a.tint} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 12, marginTop: 7, color: colors.textPrimary, fontFamily: fonts.sansBold }}>{a.label}</Text>
              <Text numberOfLines={1} style={{ fontSize: 9.5, marginTop: 1, color: colors.textSecondary, fontFamily: fonts.sans }}>{a.sub}</Text>
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
