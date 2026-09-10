import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import NativeAdCard from '../components/NativeAdCard';
import VersionSwitcher from '../components/VersionSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import ScreenHeader from '../components/ScreenHeader';
import { useContentBottomPad } from '../components/useContentBottomPad';
import { getBookById } from '../data/books';

export default function ChaptersScreen({ navigation, route }) {
  const { colors, fonts } = useTheme();
  const bottomPad = useContentBottomPad();
  const p = route.params || {};
  const bookId = p.bookId || 'gen';
  const book = getBookById(bookId) || { id: bookId, name: p.bookName || 'Genesis', chapters: 50 };
  const chapters = Array.from({ length: book.chapters || 1 }, (_, i) => i + 1);

  if (!colors) return null;

  return (
    <ParchmentBackground>
      <ScreenHeader
        title={book.name}
        onBack={() => navigation.goBack()}
        right={<><ThemeToggle size={14} /><VersionSwitcher compact /></>}
      />

      <View style={{ flex: 1, margin: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
        <FlatList
          data={chapters}
          keyExtractor={(c) => String(c)}
          numColumns={5}
          contentContainerStyle={{ padding: 10, paddingBottom: bottomPad }}
          // Native ad sits after the chapter grid — free space at the
          // bottom, seen only after the actual chapters, not before them.
          ListFooterComponent={<NativeAdCard style={{ marginTop: 6 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Verse', { bookId: book.id, bookName: book.name, chapter: item })}
              style={{ flex: 1, aspectRatio: 1, margin: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', fontFamily: fonts.serifSemi }}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <PersistentBanner />
    </ParchmentBackground>
  );
}
