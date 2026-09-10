import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import VersionSwitcher from '../components/VersionSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useVersion } from '../context/VersionContext';
import { getVerseOfTheDay } from '../data/bibleData';

const FALLBACK_VERSE = { bookId: 'psa', bookName: 'Psalms', chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.', ref: 'Psalm 23:1' };

const GRID = [
  { key: 'Books', label: 'Library', icon: 'book-outline' },
  { key: 'Search', label: 'Search', icon: 'search-outline' },
  { key: 'Bookmarks', label: 'Saved', icon: 'bookmark-outline' },
  { key: 'Planner', label: 'Reading Plan', icon: 'calendar-outline' },
  { key: 'AIQA', label: 'Ask a Question', icon: 'chatbubbles-outline' },
  { key: 'Sermon', label: 'Sermon Writer', icon: 'mic-outline' },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useTheme();
  const { version, versions } = useVersion();
  const [daily, setDaily] = useState(FALLBACK_VERSE);

  useEffect(() => {
    let cancelled = false;
    getVerseOfTheDay().then((v) => { if (!cancelled && v) setDaily(v); });
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const curVer = versions && versions.find(v => v.id === version);

  if (!colors) return null;

  return (
    <ParchmentBackground>
      {/* Everything below is sized to fit one screen — no ScrollView.
          The whole block is vertically centered as one cohesive group
          (rather than spreading space between individual rows, which
          scattered them with large gaps), so "The Holy Bible" settles a
          comfortable distance below the status bar instead of sitting
          flush against it, and the salutation stays right above the verse
          card. */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: insets.top + 14, paddingBottom: 10, justifyContent: 'center' }}>
        {/* Title — its own full-width row so it can be large/bold without
            competing for space with the controls (avoids the horizontal
            squeeze that was causing the header to spill/clip). */}
        <Text
          numberOfLines={1}
          style={{
            fontSize: 30, fontWeight: '800', color: colors.textPrimary, fontFamily: fonts.serifBold,
            letterSpacing: 0.3, lineHeight: 36,
            textShadowColor: 'rgba(62,39,35,0.22)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
          }}
        >
          The Holy Bible
        </Text>

        {/* Salutation + global controls share a row directly under the
            title — salutation still sits immediately above the daily verse. */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: colors.textSecondary, fontFamily: fonts.sans, marginRight: 8 }}>{greet} — here's today's verse</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ThemeToggle />
            <VersionSwitcher />
          </View>
        </View>

        {/* Daily verse — the real Bible serif (the same face used when
            actually reading Scripture), with a soft engraved shadow. Sized
            to its content (not flex:1) so it stays proportional to the rest
            of the page instead of stretching to fill leftover space.
            Rotates across the entire bundled KJV, one verse per day. */}
        <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginTop: 8, paddingVertical: 16, paddingHorizontal: 18 }}>
          <Text style={{ fontSize: 10, letterSpacing: 3, color: colors.gold, textAlign: 'center', fontWeight: '700' }}>VERSE OF THE DAY</Text>
          <Text
            numberOfLines={5}
            adjustsFontSizeToFit
            style={{
              fontSize: 17, color: colors.textPrimary, textAlign: 'center',
              lineHeight: 24, marginTop: 10, fontFamily: fonts.serif,
              textShadowColor: 'rgba(62,39,35,0.22)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 3,
            }}
          >
            "{daily.text}"
          </Text>
          <Text style={{ fontSize: 12, color: colors.gold, textAlign: 'center', marginTop: 10, fontWeight: '700', fontFamily: fonts.sansBold }}>— {daily.ref} ({curVer ? curVer.short : 'KJV'})</Text>
        </View>

        {/* Continue reading CTA */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Verse', { bookId: daily.bookId, bookName: daily.bookName, chapter: daily.chapter })}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Continue Reading</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 2 }}>{daily.bookName} {daily.chapter} · {curVer ? curVer.label : 'King James Version'}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

        {/* Everything else, in one compact grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {GRID.map((l) => (
            <TouchableOpacity
              key={l.key}
              onPress={() => navigation.navigate(l.key)}
              style={{ flexBasis: '31.5%', flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, alignItems: 'center' }}
            >
              <Ionicons name={l.icon} size={19} color={colors.gold} />
              <Text numberOfLines={1} style={{ fontSize: 10, marginTop: 6, fontWeight: '700', color: colors.textPrimary, fontFamily: fonts.sansBold, textAlign: 'center' }}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <PersistentBanner />
    </ParchmentBackground>
  );
}
