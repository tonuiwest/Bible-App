import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Switch, Alert, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { usePlanner } from '../context/PlannerContext';
import { getBookById } from '../data/books';
import {
  getReminder, enableReminder, disableReminder, formatReminderTime, remindersSupported,
} from '../utils/reminders';

const PRESETS = [
  { label: 'Early', hour: 6, minute: 0 },
  { label: 'Morning', hour: 7, minute: 0 },
  { label: 'Lunch', hour: 12, minute: 30 },
  { label: 'Evening', hour: 19, minute: 0 },
  { label: 'Bedtime', hour: 21, minute: 30 },
];

/** Builds "Day 5 · John 3" text for the reminder from the most recent active plan. */
export function usePlanHint() {
  const { activePlans, nextDayIndex } = usePlanner();
  const plan = activePlans[0];
  if (!plan) return null;
  const d = nextDayIndex(plan.id);
  const day = plan.days[d] || [];
  const first = day[0];
  const last = day[day.length - 1];
  const name = (r) => `${getBookById(r.b)?.name || r.b} ${r.c}`;
  const reading = !first ? '' : day.length === 1 ? name(first)
    : first.b === last.b ? `${getBookById(first.b)?.name} ${first.c}–${last.c}` : `${name(first)} – ${name(last)}`;
  return { id: plan.id, label: plan.label, day: d + 1, reading };
}

function Stepper({ value, onChange, min, max, step = 1, render, colors, fonts }) {
  const wrap = (v) => (v > max ? min : v < min ? max - ((max - min) % step) : v);
  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity onPress={() => onChange(wrap(value + step))} hitSlop={8}><Ionicons name="chevron-up" size={22} color={colors.gold} /></TouchableOpacity>
      <Text style={{ color: colors.textPrimary, fontSize: 30, fontFamily: fonts.sansBold, minWidth: 56, textAlign: 'center' }}>{render(value)}</Text>
      <TouchableOpacity onPress={() => onChange(wrap(value - step))} hitSlop={8}><Ionicons name="chevron-down" size={22} color={colors.gold} /></TouchableOpacity>
    </View>
  );
}

export default function ReminderSheet({ visible, onClose, onChanged }) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const planHint = usePlanHint();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    getReminder().then((r) => { setEnabled(r.enabled); setHour(r.hour); setMinute(r.minute); });
  }, [visible]);

  const save = async () => {
    setBusy(true);
    let r;
    if (!enabled) {
      r = await disableReminder();
    } else {
      const res = await enableReminder(hour, minute, planHint);
      if (!res.ok) {
        setBusy(false);
        if (res.reason === 'denied') {
          Alert.alert('Notifications are off', 'Allow notifications for Bible App in your phone settings to get a daily reminder.', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
          ]);
        } else {
          Alert.alert('Reminders unavailable', 'Daily reminders need the latest version of the app.');
        }
        return;
      }
      r = res.reminder;
    }
    setBusy(false);
    onChanged && onChanged(r);
    onClose();
    if (r.enabled) Alert.alert('Reminder set 🔔', `We’ll remind you to read every day at ${formatReminderTime(r)}.`);
  };

  const h12 = (h) => String(((h + 11) % 12) + 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: insets.bottom + 20 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications" size={22} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontFamily: fonts.serifBold }}>Daily reading reminder</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, fontFamily: fonts.sans }}>
                {planHint ? `Includes today’s reading from “${planHint.label}”` : 'A gentle nudge with a verse preview'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: colors.success, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          {!remindersSupported() && (
            <Text style={{ color: colors.danger, fontSize: 12, marginTop: 12, fontFamily: fonts.sans }}>
              Reminders need an updated build of the app.
            </Text>
          )}

          <View style={{ opacity: enabled ? 1 : 0.4 }} pointerEvents={enabled ? 'auto' : 'none'}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 }}>
              <Stepper value={hour} onChange={setHour} min={0} max={23} render={h12} colors={colors} fonts={fonts} />
              <Text style={{ color: colors.textPrimary, fontSize: 30, fontFamily: fonts.sansBold }}>:</Text>
              <Stepper value={minute} onChange={setMinute} min={0} max={55} step={5} render={(m) => String(m).padStart(2, '0')} colors={colors} fonts={fonts} />
              <TouchableOpacity onPress={() => setHour((hour + 12) % 24)}
                style={{ marginLeft: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.goldLight }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontFamily: fonts.sansBold }}>{hour < 12 ? 'AM' : 'PM'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 14 }}>
              {PRESETS.map((p) => {
                const on = p.hour === hour && p.minute === minute;
                return (
                  <TouchableOpacity key={p.label} onPress={() => { setHour(p.hour); setMinute(p.minute); }}
                    style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: on ? colors.success : colors.border, backgroundColor: on ? colors.successLight : colors.background }}>
                    <Text style={{ fontSize: 12, color: colors.textPrimary, fontFamily: on ? fonts.sansBold : fonts.sansMedium }}>
                      {p.label} · {formatReminderTime(p)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={busy}
              style={{ flex: 1.4, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
              <Text style={{ color: '#fff', fontFamily: fonts.sansBold }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
