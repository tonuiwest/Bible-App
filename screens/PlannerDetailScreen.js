import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import ScreenHeader from '../components/ScreenHeader';
import ProgressBar from '../components/ProgressBar';
import { useContentBottomPad } from '../components/useContentBottomPad';
import { usePlanner } from '../context/PlannerContext';
import { getBookById } from '../data/books';

const nameOf = (r) => `${getBookById(r.b)?.name || r.b} ${r.c}`;

export default function PlannerDetailScreen({ navigation, route }) {
  const { colors, fonts } = useTheme();
  const {
    getPlan, isDayDone, isReadingRead, addProgress, removeProgress, getProgress, getDoneCount,
    renewPlan, resetPlan, nextDayIndex, deleteCustomPlan,
  } = usePlanner();
  const bottomPad = useContentBottomPad();
  const plan = getPlan(route.params?.topicId);
  const [busy, setBusy] = useState(null);
  if (!colors || !plan) return null;

  const prog = getProgress(plan.id);
  const doneCount = getDoneCount(plan.id);
  const nextIdx = nextDayIndex(plan.id);
  const complete = prog === 100;

  const celebrate = () => {
    Alert.alert(
      'Reading Plan Complete! 🎉',
      `You finished “${plan.label}”. Well done! Start it again whenever you like.`,
      [{ text: 'Later', style: 'cancel' }, { text: 'Restart Plan', onPress: () => renewPlan(plan.id) }]
    );
  };

  const toggleComplete = async (dayIndex) => {
    setBusy(dayIndex);
    if (isDayDone(plan.id, dayIndex)) {
      await removeProgress(plan.id, dayIndex);
    } else {
      const result = await addProgress(plan.id, dayIndex);
      if (result?.completedPlan) celebrate();
    }
    setBusy(null);
  };

  const openReading = (dayIndex, readingIndex) => {
    const r = plan.days[dayIndex][readingIndex];
    navigation.navigate('Verse', {
      bookId: r.b,
      bookName: getBookById(r.b)?.name,
      chapter: r.c,
      planId: plan.id,
      dayIndex,
      readingIndex,
    });
  };

  const showMenu = () => {
    const buttons = [
      { text: 'Reset progress', onPress: () => resetPlan(plan.id) },
    ];
    if (plan.custom) {
      buttons.push({ text: 'Delete plan', style: 'destructive', onPress: async () => { await deleteCustomPlan(plan.id); navigation.goBack(); } });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(plan.label, 'Plan options', buttons);
  };

  const Header = (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: complete ? colors.successLight : colors.goldLight, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={complete ? 'checkmark-done' : plan.icon} size={22} color={complete ? colors.success : colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: fonts.serifBold }}>{plan.label}</Text>
          {!!plan.description && <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, fontFamily: fonts.sans }}>{plan.description}</Text>}
        </View>
      </View>
      <ProgressBar percent={prog} height={10} style={{ marginTop: 14 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sansMedium }}>{doneCount} of {plan.days.length} days complete</Text>
        <Text style={{ color: colors.success, fontSize: 12, fontFamily: fonts.sansBold }}>{prog}%</Text>
      </View>
      {!complete ? (
        <TouchableOpacity
          onPress={() => {
            const day = plan.days[nextIdx];
            const firstUnread = Math.max(0, day.findIndex((_, i) => !isReadingRead(plan.id, nextIdx, i)));
            openReading(nextIdx, firstUnread);
          }}
          style={{ marginTop: 14, backgroundColor: colors.success, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontFamily: fonts.sansBold }}>
            {doneCount === 0 ? 'Start' : 'Continue'} · Day {nextIdx + 1}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => renewPlan(plan.id)}
          style={{ marginTop: 14, backgroundColor: colors.success, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontFamily: fonts.sansBold }}>Restart Plan</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ParchmentBackground>
      <ScreenHeader
        title={plan.label.toUpperCase()}
        subtitle={`${plan.days.length} days · ${prog}% complete`}
        onBack={() => navigation.goBack()}
        right={<TouchableOpacity onPress={showMenu} hitSlop={8}><Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} /></TouchableOpacity>}
      />
      <FlatList
        data={plan.days}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={Header}
        initialNumToRender={20}
        contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }}
        renderItem={({ item: day, index }) => {
          const done = isDayDone(plan.id, index);
          const isNext = index === nextIdx && !complete;
          return (
            <View style={{ backgroundColor: colors.card, borderWidth: isNext ? 1.5 : 1, borderColor: isNext ? colors.success : colors.border, borderRadius: 14, padding: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: done ? colors.success : colors.background2, justifyContent: 'center', alignItems: 'center' }}>
                  {done
                    ? <Ionicons name="checkmark" size={16} color="#fff" />
                    : <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: fonts.sansBold }}>{index + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansBold }}>
                    Day {index + 1}{isNext ? '  ·  Up next' : ''}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1, fontFamily: fonts.sans }}>
                    {day.length} {day.length === 1 ? 'chapter' : 'chapters'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleComplete(index)}
                  disabled={busy === index}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9,
                    backgroundColor: done ? colors.successLight : colors.background2,
                    borderWidth: 1, borderColor: done ? colors.success : colors.border,
                  }}
                >
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={done ? colors.success : colors.textSecondary} />
                  <Text style={{ fontSize: 11, color: done ? colors.success : colors.textSecondary, fontFamily: fonts.sansBold }}>{done ? 'Done' : 'Mark done'}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {day.map((r, ri) => {
                  const read = isReadingRead(plan.id, index, ri);
                  return (
                    <TouchableOpacity key={ri} onPress={() => openReading(index, ri)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: read ? colors.success : colors.border, backgroundColor: read ? colors.successLight : colors.background }}>
                      <Ionicons name={read ? 'checkmark-circle' : 'book-outline'} size={12} color={read ? colors.success : colors.gold} />
                      <Text style={{ fontSize: 12, color: colors.textPrimary, fontFamily: fonts.sansMedium }}>{nameOf(r)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
      />
    </ParchmentBackground>
  );
}
