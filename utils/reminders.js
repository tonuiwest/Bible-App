import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVerseOfTheDay } from '../data/bibleData';

// Guarded so the app still runs if the native module isn't in the build yet.
let Notifications = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('[Reminder] expo-notifications not available:', e?.message);
  }
}

const KEY = 'daily_reminder_v1';
const CHANNEL_ID = 'daily-reading';
const DEFAULT = { enabled: false, hour: 7, minute: 0, id: null };

// Never let a native call or a slow verse lookup leave the Save button spinning.
const withTimeout = (p, ms, fallback) =>
  Promise.race([Promise.resolve(p), new Promise((res) => setTimeout(() => res(fallback), ms))]);

export const remindersSupported = () => !!Notifications;

/** Show reminders as a banner even if the app is open. Call once at startup. */
export function setupNotificationHandler() {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getReminder() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

async function saveReminder(r) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(r)); } catch {}
}

async function ensureChannel() {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily reading reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#C9A86A',
  });
}

async function ensurePermission() {
  if (!Notifications) return false;
  // Android 13+: the permission prompt only appears once a channel exists;
  // without it requestPermissionsAsync can hang forever (the endless spinner).
  try { await ensureChannel(); } catch (e) { console.log('[Reminder] channel:', e?.message); }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  const asked = await withTimeout(Notifications.requestPermissionsAsync(), 20000, null);
  if (asked) return !!asked.granted;
  const after = await Notifications.getPermissionsAsync();
  return !!after.granted;
}

const fmt = (h, m) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
export const formatReminderTime = (r) => fmt(r.hour, r.minute);

/**
 * Builds the notification text. The trigger repeats daily with fixed content,
 * so the app re-schedules on every launch to keep the verse preview fresh.
 */
async function buildContent(planHint) {
  const tomorrow = new Date(Date.now() + 86400000);
  let verse = null;
  try { verse = await withTimeout(getVerseOfTheDay(tomorrow), 3000, null); } catch {}
  const preview = verse
    ? `“${verse.text.length > 110 ? verse.text.slice(0, 107).replace(/\s+\S*$/, '') + '…' : verse.text}” — ${verse.ref}`
    : 'Take a few quiet minutes in God’s Word today.';
  const titles = ['Time with God 📖', 'Your daily reading is ready', 'Today’s verse is waiting', 'A moment in the Word'];
  return {
    title: planHint ? `${planHint.label} · Day ${planHint.day}` : titles[tomorrow.getDay() % titles.length],
    body: planHint ? `Today’s reading: ${planHint.reading}. ${preview}` : preview,
    data: planHint ? { screen: 'PlannerDetail', params: { topicId: planHint.id } } : { screen: 'Home' },
    sound: true,
  };
}

async function schedule(r, planHint) {
  if (!Notifications) return null;
  if (r.id) {
    try { await Notifications.cancelScheduledNotificationAsync(r.id); } catch {}
  }
  await ensureChannel();
  return Notifications.scheduleNotificationAsync({
    content: await buildContent(planHint),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: r.hour,
      minute: r.minute,
      channelId: CHANNEL_ID,
    },
  });
}

/** Turns the reminder on at hour:minute. Returns { ok, reason }. */
export async function enableReminder(hour, minute, planHint) {
  if (!Notifications) return { ok: false, reason: 'unsupported' };
  try {
    const allowed = await ensurePermission();
    if (!allowed) return { ok: false, reason: 'denied' };
    const prev = await getReminder();
    // Clear any stale copies (e.g. from older builds) so only one fires daily.
    try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
    const id = await withTimeout(schedule({ ...prev, id: null, hour, minute }, planHint), 10000, null);
    if (!id) return { ok: false, reason: 'error' };
    const next = { enabled: true, hour, minute, id };
    await saveReminder(next);
    return { ok: true, reminder: next };
  } catch (e) {
    console.log('[Reminder] enable failed:', e?.message);
    return { ok: false, reason: 'error', message: e?.message };
  }
}

export async function disableReminder() {
  const prev = await getReminder();
  if (Notifications) {
    try {
      if (prev.id) await Notifications.cancelScheduledNotificationAsync(prev.id);
    } catch {}
  }
  const next = { ...prev, enabled: false, id: null };
  await saveReminder(next);
  return next;
}

/** Called on app start: refreshes tomorrow's content if the reminder is on. */
export async function refreshReminder(planHint) {
  const r = await getReminder();
  if (!r.enabled || !Notifications) return r;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return r;
    const id = await schedule(r, planHint);
    const next = { ...r, id };
    await saveReminder(next);
    return next;
  } catch (e) {
    console.log('[Reminder] refresh failed:', e?.message);
    return r;
  }
}

/** Opens the right screen when a reminder is tapped. Returns an unsubscribe fn. */
export function listenForReminderTaps(onOpen) {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = resp?.notification?.request?.content?.data || {};
    onOpen(data.screen || 'Home', data.params);
  });
  // Cold start from a tapped notification.
  Notifications.getLastNotificationResponseAsync?.().then((resp) => {
    const data = resp?.notification?.request?.content?.data;
    if (data?.screen) onOpen(data.screen, data.params);
  }).catch(() => {});
  return () => sub.remove();
}
