import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

/*
 * Narration settings for read-aloud.
 *
 * Two layers give real variety on every phone:
 *  1. Narrator styles — tuned pitch + pace presets (work even if the phone
 *     only has one installed voice).
 *  2. Device voices — every English voice the phone's text-to-speech engine
 *     provides (Google / Samsung / Apple voices, male & female, several
 *     accents). More can be added free from the phone's TTS settings.
 */

const KEY = 'tts_settings_v1';

export const NARRATOR_STYLES = [
  { id: 'classic', label: 'Classic', desc: 'Warm, steady reading', pitch: 1.0, rate: 0.92, icon: 'book-outline' },
  { id: 'deep', label: 'Deep Narrator', desc: 'Low, reverent tone', pitch: 0.78, rate: 0.86, icon: 'mic-outline' },
  { id: 'gentle', label: 'Gentle', desc: 'Soft and slow, for devotions', pitch: 1.08, rate: 0.8, icon: 'leaf-outline' },
  { id: 'storyteller', label: 'Storyteller', desc: 'Lively, for narratives', pitch: 1.12, rate: 1.0, icon: 'sparkles-outline' },
  { id: 'elder', label: 'Elder', desc: 'Measured and wise', pitch: 0.9, rate: 0.78, icon: 'hourglass-outline' },
  { id: 'brisk', label: 'Brisk', desc: 'Faster, for long chapters', pitch: 1.0, rate: 1.15, icon: 'speedometer-outline' },
];

export const SPEEDS = [0.75, 0.9, 1.0, 1.15, 1.3];

const DEFAULTS = { styleId: 'classic', voiceId: null, voiceLang: null, speed: 1.0 };

let cache = null;

export async function getTtsSettings() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export async function saveTtsSettings(next) {
  cache = { ...DEFAULTS, ...next };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  return cache;
}

const REGION = {
  US: 'American', GB: 'British', AU: 'Australian', IN: 'Indian', NG: 'Nigerian', KE: 'Kenyan',
  ZA: 'South African', IE: 'Irish', CA: 'Canadian', NZ: 'New Zealand', GH: 'Ghanaian', TZ: 'Tanzanian',
  SG: 'Singaporean', PH: 'Filipino', SC: 'Scottish', JM: 'Jamaican',
};

/** Turns raw engine voices into a friendly, de-duplicated English list. */
export async function getNarratorVoices() {
  let voices = [];
  try { voices = await Speech.getAvailableVoicesAsync(); } catch {}
  const english = (voices || []).filter((v) => /^en([-_]|$)/i.test(v.language || ''));
  const counters = {};
  const list = english
    .map((v) => {
      const region = String(v.language || '').split(/[-_]/)[1]?.toUpperCase();
      const accent = REGION[region] || (region ? region : 'English');
      const raw = String(v.name || v.identifier || '');
      // iOS gives real names ("Daniel", "Samantha"); Android gives codes.
      const human = Platform.OS === 'ios' && !/com\.apple/i.test(raw) ? raw : null;
      counters[accent] = (counters[accent] || 0) + 1;
      const enhanced = v.quality === 'Enhanced' || /enhanced|premium|neural|network/i.test(raw + (v.identifier || ''));
      return {
        id: v.identifier,
        language: v.language,
        label: human ? `${human} · ${accent}` : `${accent} voice ${counters[accent]}`,
        accent,
        enhanced,
        offline: !/network/i.test(v.identifier || ''),
      };
    });
  // Offline voices first (no data needed), then by accent.
  return list.sort((a, b) => (b.offline - a.offline) || a.accent.localeCompare(b.accent) || a.label.localeCompare(b.label));
}

/** Options to pass to Speech.speak for the current settings. */
export function speechOptions(settings) {
  const s = settings || cache || DEFAULTS;
  const style = NARRATOR_STYLES.find((x) => x.id === s.styleId) || NARRATOR_STYLES[0];
  const opts = {
    pitch: style.pitch,
    rate: Math.max(0.5, Math.min(1.8, style.rate * (s.speed || 1))),
    language: s.voiceLang || 'en-US',
  };
  if (s.voiceId) opts.voice = s.voiceId;
  return opts;
}

export function speakSample(settings, onDone) {
  Speech.stop();
  Speech.speak('The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures.', {
    ...speechOptions(settings),
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}
