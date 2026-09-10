import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import ScreenHeader from '../components/ScreenHeader';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePlanner } from '../context/PlannerContext';
import { getBookById } from '../data/books';

export default function PlannerDetailScreen({ navigation, route }) {
  const { colors, fonts } = useTheme();
  const { plans, isDayDone, addProgress, removeProgress, getProgress, renewPlan } = usePlanner();
  const bottomPad = useContentBottomPad();
  const topic = plans.find((p) => p.id === route.params?.topicId);
  const [busy, setBusy] = useState(null);
  if (!colors || !topic) return null;

  const prog = getProgress(topic.id);

  const toggleComplete = async (dayIndex) => {
    setBusy(dayIndex);
    const wasDone = isDayDone(topic.id, dayIndex);
    if (wasDone) {
      await removeProgress(topic.id, dayIndex);
    } else {
      const result = await addProgress(topic.id, dayIndex);
      if (result?.completedPlan) {
        Alert.alert(
          'Reading Plan Complete! 🎉',
          `You've finished "${topic.label}". It will now reset so you can go through it again.`,
          [{ text: 'Restart Reading Plan', onPress: () => renewPlan(topic.id) }]
        );
      }
    }
    setBusy(null);
  };

  const openReading = (item, index) => {
    // "Tap to read" auto-marks the day complete — the planner tracks
    // reading progress automatically. The Mark Complete button next to it
    // remains available for manually marking/unmarking (e.g. read elsewhere,
    // or correcting a mistake) without needing to reopen the passage.
    navigation.navigate('Verse', {
      bookId: item.bookId,
      bookName: getBookById(item.bookId)?.name,
      chapter: item.ch,
      planId: topic.id,
      dayIndex: index,
    });
  };

  return (
    <ParchmentBackground>
      <ScreenHeader title={topic.label.toUpperCase()} subtitle={`${topic.days} days · ${prog}% complete`} onBack={() => navigation.goBack()} />
      <FlatList
        data={topic.verses}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12, paddingBottom: bottomPad }}
        renderItem={({ item, index }) => {
          const done = isDayDone(topic.id, index);
          const book = getBookById(item.bookId);
          return (
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => openReading(item, index)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.background2, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontFamily: fonts.sansBold }}>{book?.name} {item.ch}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 1 }}>Tap to read</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleComplete(index)}
                disabled={busy === index}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                  backgroundColor: done ? colors.goldLight : colors.background2,
                  borderWidth: 1, borderColor: done ? colors.gold : colors.border,
                }}
              >
                <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={done ? colors.gold : colors.textSecondary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: done ? colors.gold : colors.textSecondary }}>{done ? 'Done' : 'Mark Complete'}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
      <PersistentBanner />
    </ParchmentBackground>
  );
}
