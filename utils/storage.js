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

const STREAK_KEY = '@bible_streak';

export const getStreak = async () => {
  try {
    const value = await AsyncStorage.getItem(STREAK_KEY);
    return value != null ? parseInt(value, 10) : 0;
  } catch (e) {
    console.error('Failed to load streak:', e);
    return 0;
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