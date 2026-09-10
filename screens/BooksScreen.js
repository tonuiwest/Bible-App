import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import NativeAdCard from '../components/NativeAdCard';
import VersionSwitcher from '../components/VersionSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import ScreenHeader from '../components/ScreenHeader';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BOOKS } from '../data/books';
import { AdManager } from '../ads/AdManager';

export default function BooksScreen({ navigation }) {
  const { colors, fonts } = useTheme();
  const bottomPad = useContentBottomPad();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  // data/books.js doesn't carry a `testament` field — derive it from the
  // canonical book number instead (1-39 = Old Testament, 40-66 = New).
  // The Old/New filters were previously comparing against `undefined` and
  // always returning empty.
  const testamentOf = (b) => (b.num <= 39 ? 'old' : 'new');

  const list = BOOKS.filter((b) => {
    const t = testamentOf(b);
    let ok = true;
    if (filter === 'old') ok = t === 'old';
    if (filter === 'new') ok = t === 'new';
    if (!ok) return false;
    if (q) return b.name.toLowerCase().indexOf(q.toLowerCase()) > -1;
    return true;
  });

  const openBook = (item) => {
    AdManager.tryShowInterstitial({ isNaturalBreak: false });
    navigation.navigate('Chapters', { bookId: item.id, bookName: item.name });
  };

  if (!colors) return null;

  return (
    <ParchmentBackground>
      <ScreenHeader
        title={`LIBRARY · ${list.length}`}
        onBack={() => navigation.goBack()}
        right={<><ThemeToggle size={14} /><VersionSwitcher compact /></>}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', margin: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, height: 38 }}>
        <Ionicons name="search-outline" size={14} color={colors.textSecondary} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search 66 books" placeholderTextColor={colors.textSecondary} style={{ flex: 1, fontSize: 12, color: colors.textPrimary, marginLeft: 6, fontFamily: fonts.sans }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 8 }}>
        <TouchableOpacity onPress={() => setFilter('all')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: filter === 'all' ? colors.primary : colors.card, borderColor: filter === 'all' ? colors.primary : colors.border }}><Text style={{ color: filter === 'all' ? '#fff' : colors.textPrimary, fontSize: 11 }}>All {BOOKS.length}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter('old')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: filter === 'old' ? colors.primary : colors.card, borderColor: filter === 'old' ? colors.primary : colors.border }}><Text style={{ color: filter === 'old' ? '#fff' : colors.textPrimary, fontSize: 11 }}>Old 39</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter('new')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: filter === 'new' ? colors.primary : colors.card, borderColor: filter === 'new' ? colors.primary : colors.border }}><Text style={{ color: filter === 'new' ? '#fff' : colors.textPrimary, fontSize: 11 }}>New 27</Text></TouchableOpacity>
      </View>

      <View style={{ flex: 1, margin: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
        <FlatList
          data={list}
          keyExtractor={(b) => b.id}
          numColumns={2}
          contentContainerStyle={{ padding: 8, paddingBottom: bottomPad }}
          // A single native ad in the natural free space above the grid —
          // never mid-list, never disrupting the reading flow.
          // Native ad sits after all 66 books — free space at the bottom
          // of the list, seen only once someone has scrolled through the
          // actual content, instead of interrupting before it.
          ListFooterComponent={!q ? <NativeAdCard style={{ marginHorizontal: 4, marginTop: 4 }} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openBook(item)} style={{ flex: 1, margin: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 10, padding: 10, minHeight: 60 }}>
              <Text style={{ color: colors.gold, fontSize: 8 }}>{testamentOf(item) === 'old' ? 'OLD' : 'NEW'} · {item.chapters} CH</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4, fontFamily: fonts.serifSemi }}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <PersistentBanner />
    </ParchmentBackground>
  );
}
