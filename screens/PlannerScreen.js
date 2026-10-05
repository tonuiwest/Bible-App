import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import ScreenHeader from '../components/ScreenHeader';
import ThemeToggle from '../components/ThemeToggle';
import ProgressBar from '../components/ProgressBar';
import NativeAdCard from '../components/NativeAdCard';
import { useContentBottomPad } from '../components/useContentBottomPad';
import { usePlanner } from '../context/PlannerContext';
import { CATEGORIES } from '../data/readingPlans';
import { getBookById } from '../data/books';

function describeDay(day) {
  if (!day || !day.length) return '';
  const first = day[0];
  const last = day[day.length - 1];
  const fb = getBookById(first.b)?.name || first.b;
  const lb = getBookById(last.b)?.name || last.b;
  if (day.length === 1) return `${fb} ${first.c}`;
  if (first.b === last.b) return `${fb} ${first.c}–${last.c}`;
  return `${fb} ${first.c} – ${lb} ${last.c}`;
}

export default function PlannerScreen({ navigation }) {
  const { colors, fonts } = useTheme();
  const { plans, getProgress, getDoneCount, cycles, activePlans, nextDayIndex, deleteCustomPlan } = usePlanner();
  const bottomPad = useContentBottomPad();
  const [cat, setCat] = useState('topic');

  const list = useMemo(() => plans.filter((p) => p.category === cat), [plans, cat]);
  const hero = activePlans[0];

  const confirmDelete = (plan) => {
    Alert.alert('Delete plan?', `“${plan.label}” and its progress will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCustomPlan(plan.id) },
    ]);
  };

  const Header = (
    <View>
      {hero ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('PlannerDetail', { topicId: hero.id })}>
          <LinearGradient colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 18, padding: 16, marginBottom: 14 }}>
            <Text style={{ color: '#E9D8B4', fontSize: 10, letterSpacing: 2, fontFamily: fonts.sansBold }}>CONTINUE YOUR PLAN</Text>
            <Text style={{ color: '#FFF', fontSize: 20, marginTop: 6, fontFamily: fonts.serifBold }}>{hero.label}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4, fontFamily: fonts.sans }}>
              Day {nextDayIndex(hero.id) + 1} of {hero.days.length} · {describeDay(hero.days[nextDayIndex(hero.id)])}
            </Text>
            <ProgressBar percent={getProgress(hero.id)} height={8} style={{ marginTop: 12 }} trackColor="rgba(255,255,255,0.18)" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: fonts.sansMedium }}>
                {getDoneCount(hero.id)} of {hero.days.length} days
              </Text>
              <Text style={{ color: '#7BE0A5', fontSize: 11, fontFamily: fonts.sansBold }}>{getProgress(hero.id)}%</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={() => navigation.navigate('CreatePlan')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.success, backgroundColor: colors.successLight, marginBottom: 14 }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 14 }}>Create your own plan</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 11, marginTop: 2 }}>Pick any books or chapters and set your own pace</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.success} />
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {CATEGORIES.map((c) => {
          const on = c.id === cat;
          const count = plans.filter((p) => p.category === c.id).length;
          return (
            <TouchableOpacity key={c.id} onPress={() => setCat(c.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }}>
              <Text style={{ color: on ? colors.onPrimary : colors.textPrimary, fontSize: 12, fontFamily: on ? fonts.sansBold : fonts.sansMedium }}>
                {c.label} · {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <ParchmentBackground>
      <ScreenHeader title="READING PLANS" subtitle={`${plans.length} plans`} onBack={() => navigation.goBack()} right={<ThemeToggle />} />
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={Header}
        ListFooterComponent={<NativeAdCard style={{ marginTop: 4 }} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 30 }}>
            <Ionicons name="create-outline" size={30} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center', fontFamily: fonts.sans }}>
              You haven’t created a plan yet.{'\n'}Tap “Create your own plan” above.
            </Text>
          </View>
        }
        contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }}
        renderItem={({ item }) => {
          const prog = getProgress(item.id);
          const complete = prog === 100;
          const cycleCount = cycles[item.id] || 0;
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('PlannerDetail', { topicId: item.id })}
              onLongPress={item.custom ? () => confirmDelete(item) : undefined}
              style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: complete ? colors.successLight : colors.goldLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={complete ? 'checkmark-done' : item.icon} size={20} color={complete ? colors.success : colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.textPrimary, fontSize: 14, fontFamily: fonts.sansBold }}>{item.label}</Text>
                  {cycleCount > 0 && (
                    <View style={{ backgroundColor: colors.successLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: colors.success, fontFamily: fonts.sansBold }}>×{cycleCount}</Text>
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2, fontFamily: fonts.sans }}>
                  {item.description || `${item.days.length} days`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <ProgressBar percent={prog} height={6} style={{ flex: 1 }} />
                  <Text style={{ color: prog > 0 ? colors.success : colors.textSecondary, fontSize: 11, minWidth: 34, textAlign: 'right', fontFamily: fonts.sansBold }}>
                    {prog}%
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4, fontFamily: fonts.sans }}>
                  {item.days.length} days{item.custom ? ' · long-press to delete' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </ParchmentBackground>
  );
}
