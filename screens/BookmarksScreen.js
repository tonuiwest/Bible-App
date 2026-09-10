import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import ThemeToggle from '../components/ThemeToggle';
import ScreenHeader from '../components/ScreenHeader';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BookmarksScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const colors = theme?.colors;
  const fonts = theme?.fonts || { serif: 'serif', sans: 'sans-serif', serifBold: 'serif', sansBold: 'sans-serif' };
  const bottomPad = useContentBottomPad();
  const [items, setItems] = useState([]);
  const load = async () => { const d = await AsyncStorage.getItem('bookmarks'); setItems(JSON.parse(d || '[]').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))); };
  useFocusEffect(useCallback(() => { load(); }, []));

  const remove = async (id) => {
    const next = items.filter(i => i.id !== id);
    setItems(next);
    await AsyncStorage.setItem('bookmarks', JSON.stringify(next));
  };

  if (!colors) return null;

  return (
    <ParchmentBackground>
      <ScreenHeader title="BOOKMARKS" onBack={() => navigation.goBack()} right={<ThemeToggle size={14} />} />
      <View style={[styles.page, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 12, paddingBottom: bottomPad }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 60, color: colors.textSecondary, fontFamily: fonts.sans }}>No saved verses yet</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Verse', { bookId: item.bookId, bookName: item.bookName, chapter: item.chapter })}
              style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1, fontFamily: fonts.sansBold }}>{item.bookName} {item.chapter}:{item.verse}</Text>
                <TouchableOpacity onPress={() => remove(item.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={15} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textPrimary, marginTop: 6, lineHeight: 20, fontFamily: fonts.serif }}>{item.text}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      <PersistentBanner />
    </ParchmentBackground>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, margin: 10, borderRadius: 16, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
});
