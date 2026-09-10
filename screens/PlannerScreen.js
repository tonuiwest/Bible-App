import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import ScreenHeader from '../components/ScreenHeader';
import ThemeToggle from '../components/ThemeToggle';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePlanner } from '../context/PlannerContext';

export default function PlannerScreen({ navigation }) {
  const { colors, fonts } = useTheme();
  const { plans, getProgress, cycles } = usePlanner();
  const bottomPad = useContentBottomPad();
  if (!colors) return null;

  return (
    <ParchmentBackground>
      <ScreenHeader title="READING PLANS" onBack={() => navigation.goBack()} right={<ThemeToggle />} />
      <FlatList
        data={plans}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12, paddingBottom: bottomPad }}
        renderItem={({ item }) => {
          const prog = getProgress(item.id);
          const complete = prog === 100;
          const cycleCount = cycles[item.id] || 0;
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('PlannerDetail', { topicId: item.id })}
              style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.goldLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={item.icon} size={19} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontFamily: fonts.sansBold }}>{item.label}</Text>
                  {cycleCount > 0 && (
                    <View style={{ backgroundColor: colors.background2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: colors.textSecondary, fontWeight: '700' }}>×{cycleCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>{item.days} days · {item.verses.length} readings</Text>
                <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <View style={{ width: `${prog}%`, height: 6, backgroundColor: colors.gold, borderRadius: 3 }} />
                </View>
              </View>
              {complete ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
              ) : (
                <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 12 }}>{prog}%</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
      <PersistentBanner />
    </ParchmentBackground>
  );
}
