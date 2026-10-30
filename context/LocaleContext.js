import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import resources from '../localization/strings.json';

const STORAGE_KEY = 'app_locale';
const LocaleContext = createContext(null);
const languageCodes = resources.languages.map((language) => language.code);

export function isRTLLocale(locale) {
  return ['ar', 'fa', 'he', 'ur'].includes(locale.split('-')[0]);
}

function getDeviceLocale() {
  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale.replace('_', '-');
  const exact = languageCodes.find((code) => code.toLowerCase() === deviceLocale.toLowerCase());
  if (exact) return exact;
  const language = deviceLocale.split('-')[0].toLowerCase();
  if (language === 'zh') {
    return /hant|hk|tw|mo/i.test(deviceLocale) ? 'zh-TW' : 'zh-CN';
  }
  if (language === 'sr') {
    return /cyrl/i.test(deviceLocale) ? 'sr' : 'sr-Latn';
  }
  return languageCodes.find((code) => code.split('-')[0].toLowerCase() === language) || 'en-US';
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getDeviceLocale);
  const [localeSetting, setLocaleSetting] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && languageCodes.includes(saved)) {
        setLocaleSetting(saved);
        setLocaleState(saved);
      }
    }).catch((error) => {
      console.warn('Could not load the saved app language.', error);
    });
  }, []);

  const setLocale = async (value) => {
    if (value === 'system') {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setLocaleSetting('system');
      setLocaleState(getDeviceLocale());
      return;
    }
    if (!languageCodes.includes(value)) {
      throw new Error(`Unsupported app language: ${value}`);
    }
    await AsyncStorage.setItem(STORAGE_KEY, value);
    setLocaleSetting(value);
    setLocaleState(value);
  };

  const value = useMemo(() => ({
    locale,
    localeSetting,
    languages: resources.languages,
    setLocale,
    translate: (text) => resources.strings[locale]?.[text] || text,
  }), [locale, localeSetting]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider.');
  return context;
}
