import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import ThemeToggle from '../components/ThemeToggle';
import ScreenHeader from '../components/ScreenHeader';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BOOKS } from '../data/books';
import { searchVerses } from '../data/bibleData';

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const bottomPad = useContentBottomPad();
  const [mode, setMode] = useState('books'); // books | verses
  const [q, setQ] = useState('');
  const [verseRes, setVerseRes] = useState([]);

  useEffect(() => {
    if (mode === 'verses' && q.length >= 2) { searchVerses(q, 'kjv', 20).then(setVerseRes); }
    else setVerseRes([]);
  }, [q, mode]);

  const bookRes = mode === 'books' && q.length >= 1 ? BOOKS.filter((b) => b.name.toLowerCase().indexOf(q.toLowerCase()) > -1) : [];

  if (!colors) return null;

  return (
    <ParchmentBackground>
      <ScreenHeader title="SEARCH" onBack={() => navigation.goBack()} right={<ThemeToggle size={14} />} />

      <View style={{ flexDirection: 'row', margin: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, height: 42, alignItems: 'center' }}>
        <Ionicons name="search" size={16} color={colors.gold} />
        <TextInput value={q} onChangeText={setQ} placeholder={mode === 'books' ? 'Search books (e.g. Genesis)...' : 'Search verses (e.g. peace)...'} placeholderTextColor={colors.textSecondary} style={{ flex: 1, fontSize: 13, color: colors.textPrimary, marginLeft: 8 }} autoFocus />
        {q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={16} color={colors.textSecondary} /></TouchableOpacity>}
      </View>

      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 8, marginBottom: 8 }}>
        <TouchableOpacity onPress={() => setMode('books')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: mode === 'books' ? colors.primary : colors.card, borderColor: mode === 'books' ? colors.primary : colors.border }}><Text style={{ color: mode === 'books' ? '#fff' : colors.textPrimary, fontSize: 11 }}>Books</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('verses')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: mode === 'verses' ? colors.primary : colors.card, borderColor: mode === 'verses' ? colors.primary : colors.border }}><Text style={{ color: mode === 'verses' ? '#fff' : colors.textPrimary, fontSize: 11 }}>Verses</Text></TouchableOpacity>
      </View>

      <View style={{ flex: 1, margin: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
        {mode === 'books' ? (
          <FlatList data={q ? bookRes : BOOKS.slice(0, 20)} keyExtractor={(b) => b.id} contentContainerStyle={{ padding: 8, paddingBottom: bottomPad }} renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('Chapters', { bookId: item.id, bookName: item.name })} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.background2, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="book-outline" size={14} color={colors.gold} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{item.name}</Text><Text style={{ color: colors.textSecondary, fontSize: 10 }}>{item.chapters} chapters</Text></View>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )} />
        ) : (
          <FlatList data={verseRes} keyExtractor={(_, i) => String(i)} contentContainerStyle={{ padding: 8, paddingBottom: bottomPad }} ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30, color: colors.textSecondary }}>{q ? 'No verses found' : 'Type to search verses'}</Text>} renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('Verse', { bookId: item.bookId, bookName: item.bookName, chapter: item.chapter, highlightVerse: item.verse })} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.gold, fontSize: 10, fontWeight: '700' }}>{item.ref}</Text>
              <Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 12, marginTop: 4 }}>{item.text}</Text>
            </TouchableOpacity>
          )} />
        )}
      </View>
      <PersistentBanner />
    </ParchmentBackground>
  );
}
