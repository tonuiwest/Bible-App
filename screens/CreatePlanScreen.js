import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, FlatList, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import ScreenHeader from '../components/ScreenHeader';
import { useContentBottomPad } from '../components/useContentBottomPad';
import { usePlanner } from '../context/PlannerContext';
import { BOOKS } from '../data/books';
import { BOOK_GROUPS, PLAN_ICONS } from '../data/readingPlans';

const DAY_PRESETS = [7, 14, 21, 30, 40, 90, 180, 365];

function Stepper({ value, onChange, min = 1, max = 999, colors, fonts }) {
  const btn = (delta, icon) => (
    <TouchableOpacity
      onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))}
      style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={16} color={colors.textPrimary} />
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {btn(-1, 'remove')}
      <Text style={{ minWidth: 44, textAlign: 'center', color: colors.textPrimary, fontSize: 18, fontFamily: fonts.sansBold }}>{value}</Text>
      {btn(1, 'add')}
    </View>
  );
}

function Section({ title, children, right, colors, fonts }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1.5, fontFamily: fonts.sansBold }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export default function CreatePlanScreen({ navigation }) {
  const { colors, fonts } = useTheme();
  const { createCustomPlan } = usePlanner();
  const bottomPad = useContentBottomPad(20);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(PLAN_ICONS[0]);
  const [mode, setMode] = useState('books'); // books | passages
  const [selected, setSelected] = useState([]); // bookIds
  const [fromCh, setFromCh] = useState(1);
  const [toCh, setToCh] = useState(1);
  const [days, setDays] = useState(30);
  const [passages, setPassages] = useState([]); // [{b,c}] one per day
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickBook, setPickBook] = useState(BOOKS[42]); // John
  const [pickCh, setPickCh] = useState(1);
  const [saving, setSaving] = useState(false);

  const single = selected.length === 1 ? BOOKS.find((b) => b.id === selected[0]) : null;

  const totalChapters = useMemo(() => {
    if (single) return Math.max(0, toCh - fromCh + 1);
    return selected.reduce((n, id) => n + (BOOKS.find((b) => b.id === id)?.chapters || 0), 0);
  }, [selected, single, fromCh, toCh]);

  const effectiveDays = Math.min(days, Math.max(1, totalChapters));
  const perDay = totalChapters ? (totalChapters / effectiveDays) : 0;
  const finish = new Date(Date.now() + (effectiveDays - 1) * 86400000);

  const toggleBook = (id) => {
    setSelected((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      const ordered = BOOKS.filter((b) => next.includes(b.id)).map((b) => b.id);
      if (ordered.length === 1) {
        const bk = BOOKS.find((b) => b.id === ordered[0]);
        setFromCh(1); setToCh(bk.chapters);
      }
      return ordered;
    });
  };

  const applyGroup = (g) => {
    const allIn = g.books.every((id) => selected.includes(id));
    const next = allIn ? selected.filter((id) => !g.books.includes(id)) : Array.from(new Set([...selected, ...g.books]));
    const ordered = BOOKS.filter((b) => next.includes(b.id)).map((b) => b.id);
    setSelected(ordered);
    if (ordered.length === 1) { const bk = BOOKS.find((b) => b.id === ordered[0]); setFromCh(1); setToCh(bk.chapters); }
  };

  const addPassage = () => {
    setPassages((p) => [...p, { b: pickBook.id, c: pickCh }]);
    // Advance to the next chapter for quick sequential adding.
    if (pickCh < pickBook.chapters) setPickCh(pickCh + 1);
  };

  const canCreate = name.trim().length > 0 && (mode === 'books' ? totalChapters > 0 : passages.length > 0);

  const create = async () => {
    if (!canCreate || saving) {
      if (!name.trim()) Alert.alert('Name your plan', 'Give your reading plan a name first.');
      return;
    }
    setSaving(true);
    try {
      const plan = mode === 'books'
        ? await createCustomPlan({
            label: name, icon, bookIds: selected, days: effectiveDays,
            fromChapter: single ? fromCh : undefined, toChapter: single ? toCh : undefined,
            description: single
              ? `${single.name} ${fromCh}–${toCh} in ${effectiveDays} days`
              : `${selected.length} book${selected.length > 1 ? 's' : ''} in ${effectiveDays} days`,
          })
        : await createCustomPlan({
            label: name, icon, readings: passages.map((p) => [p]),
            description: `${passages.length} hand-picked readings`,
          });
      navigation.replace('PlannerDetail', { topicId: plan.id });
    } catch (e) {
      Alert.alert('Could not create plan', e?.message || 'Please try again.');
    }
    setSaving(false);
  };

  const chip = (on, label, onPress, key) => (
    <TouchableOpacity key={key || label} onPress={onPress}
      style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: on ? colors.success : colors.border, backgroundColor: on ? colors.successLight : colors.background }}>
      <Text style={{ fontSize: 12, color: on ? colors.success : colors.textPrimary, fontFamily: on ? fonts.sansBold : fonts.sansMedium }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ParchmentBackground>
      <ScreenHeader title="CREATE A PLAN" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
        <Section colors={colors} fonts={fonts} title="PLAN NAME">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Morning Psalms, Gospels before Easter…"
            placeholderTextColor={colors.textSecondary}
            maxLength={40}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, backgroundColor: colors.background, fontFamily: fonts.sans, fontSize: 14 }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {PLAN_ICONS.map((ic) => (
              <TouchableOpacity key={ic} onPress={() => setIcon(ic)}
                style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: icon === ic ? colors.success : colors.border, backgroundColor: icon === ic ? colors.successLight : colors.background }}>
                <Ionicons name={ic} size={18} color={icon === ic ? colors.success : colors.gold} />
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[['books', 'Books & chapters', 'library-outline'], ['passages', 'Pick passages', 'list-outline']].map(([id, label, ic]) => {
            const on = mode === id;
            return (
              <TouchableOpacity key={id} onPress={() => setMode(id)}
                style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }}>
                <Ionicons name={ic} size={15} color={on ? colors.onPrimary : colors.textPrimary} />
                <Text style={{ color: on ? colors.onPrimary : colors.textPrimary, fontSize: 12, fontFamily: fonts.sansBold }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {mode === 'books' ? (
          <>
            <Section colors={colors} fonts={fonts} title="QUICK SELECT">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {BOOK_GROUPS.map((g) => chip(g.books.every((id) => selected.includes(id)), g.label, () => applyGroup(g), g.id))}
              </View>
            </Section>

            <Section colors={colors} fonts={fonts} title={`BOOKS · ${selected.length} SELECTED`} right={selected.length ? (
              <TouchableOpacity onPress={() => setSelected([])}><Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.sansMedium }}>Clear</Text></TouchableOpacity>
            ) : null}>
              <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1, marginBottom: 6, fontFamily: fonts.sansBold }}>OLD TESTAMENT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {BOOKS.filter((b) => b.num <= 39).map((b) => chip(selected.includes(b.id), b.name, () => toggleBook(b.id), b.id))}
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1, marginTop: 12, marginBottom: 6, fontFamily: fonts.sansBold }}>NEW TESTAMENT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {BOOKS.filter((b) => b.num > 39).map((b) => chip(selected.includes(b.id), b.name, () => toggleBook(b.id), b.id))}
              </View>
            </Section>

            {single && (
              <Section colors={colors} fonts={fonts} title={`${single.name.toUpperCase()} · CHAPTERS`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 6, fontFamily: fonts.sans }}>From</Text>
                    <Stepper value={fromCh} onChange={(v) => { setFromCh(v); if (v > toCh) setToCh(v); }} min={1} max={single.chapters} colors={colors} fonts={fonts} />
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 6, fontFamily: fonts.sans }}>To</Text>
                    <Stepper value={toCh} onChange={(v) => { setToCh(v); if (v < fromCh) setFromCh(v); }} min={1} max={single.chapters} colors={colors} fonts={fonts} />
                  </View>
                </View>
              </Section>
            )}

            <Section colors={colors} fonts={fonts} title="HOW MANY DAYS?">
              <View style={{ alignItems: 'center' }}>
                <Stepper value={days} onChange={setDays} min={1} max={730} colors={colors} fonts={fonts} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' }}>
                {DAY_PRESETS.map((d) => chip(days === d, `${d}`, () => setDays(d), `d${d}`))}
              </View>
              {totalChapters > 0 && (
                <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.successLight }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansBold }}>
                    {totalChapters} chapters · about {perDay < 1.05 ? '1 chapter' : `${perDay.toFixed(1)} chapters`} a day
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3, fontFamily: fonts.sans }}>
                    {effectiveDays} days{effectiveDays < days ? ' (one chapter per day max)' : ''} · finish around {finish.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              )}
            </Section>
          </>
        ) : (
          <Section colors={colors} fonts={fonts} title={`READINGS · ${passages.length} DAYS`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => setPickerOpen(true)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium }}>{pickBook.name}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <Stepper value={pickCh} onChange={setPickCh} min={1} max={pickBook.chapters} colors={colors} fonts={fonts} />
            </View>
            <TouchableOpacity onPress={addPassage}
              style={{ marginTop: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.success }}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: fonts.sansBold }}>Add {pickBook.name} {pickCh} as Day {passages.length + 1}</Text>
            </TouchableOpacity>
            {passages.map((p, i) => (
              <View key={`${p.b}-${p.c}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i === passages.length - 1 ? 0 : 1, borderBottomColor: colors.border, marginTop: i === 0 ? 10 : 0 }}>
                <Text style={{ width: 54, color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sansBold }}>Day {i + 1}</Text>
                <Text style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium }}>{BOOKS.find((b) => b.id === p.b)?.name} {p.c}</Text>
                <TouchableOpacity hitSlop={8} onPress={() => setPassages((cur) => cur.filter((_, j) => j !== i))}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </Section>
        )}

        <TouchableOpacity onPress={create} disabled={saving}
          style={{ marginTop: 4, paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: canCreate ? colors.success : colors.border, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 15, fontFamily: fonts.sansBold }}>{saving ? 'Creating…' : 'Create Plan'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '75%', backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 }} />
            <FlatList
              data={BOOKS}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { setPickBook(item); setPickCh(1); setPickerOpen(false); }}
                  style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium }}>{item.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sans }}>{item.chapters} ch</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ParchmentBackground>
  );
}
