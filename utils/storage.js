import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storing the last read verse
const STORAGE_KEY = '@bible_last_read';

/**
 * Saves the last read location
 * @param {Object} data - Contains bookId, bookName, chapter, verse
 */
export const saveLastRead = async (data) => {
  try {
    const jsonValue = JSON.stringify(data);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
};

/**
 * Retrieves the last read location
 */
export const getLastRead = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Failed to load progress:', e);
    return null;
  }
};

const STREAK_KEY = '@bible_streak_v2';

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const yesterdayKey = () => dayKey(new Date(Date.now() - 86400000));

/**
 * Reading streak: consecutive days on which at least one chapter was opened.
 * Returns { count, best, readToday }.
 */
export const getStreak = async () => {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (!s) return { count: 0, best: 0, readToday: false, totalDays: 0 };
    const today = dayKey();
    const alive = s.last === today || s.last === yesterdayKey();
    return { count: alive ? s.count : 0, best: s.best || 0, readToday: s.last === today, totalDays: s.totalDays || 0 };
  } catch (e) {
    return { count: 0, best: 0, readToday: false, totalDays: 0 };
  }
};

/** Call whenever a chapter is opened. Safe to call many times a day. */
export const recordReadingDay = async () => {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    const s = raw ? JSON.parse(raw) : { count: 0, best: 0, last: null, totalDays: 0 };
    const today = dayKey();
    if (s.last === today) return s;
    const count = s.last === yesterdayKey() ? (s.count || 0) + 1 : 1;
    const next = { count, best: Math.max(s.best || 0, count), last: today, totalDays: (s.totalDays || 0) + 1 };
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    return null;
  }
};

/**
 * Generic settings helper to save small app settings
 * @param {string} key
 * @param {*} value
 */
export const saveSetting = async (key, value) => {
  try {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    return true;
  } catch (e) {
    console.error('Failed to save setting:', e);
    return false;
  }
};

/**
 * Read a saved setting, optionally returning a default when missing
 * @param {string} key
 * @param {*} defaultValue
 */
export const getSetting = async (key, defaultValue = null) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value == null) return defaultValue;
    try {
      return JSON.parse(value);
    } catch (_e) {
      // not JSON, return raw string
      return value;
    }
  } catch (e) {
    console.error('Failed to read setting:', e);
    return defaultValue;
  }
};