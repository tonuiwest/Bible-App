import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const Light = {
  mode: 'day',
  background: '#F9F1E7',
  background2: '#F5E9D4',
  parchment: '#FDF6E3',
  parchmentDark: '#EADDC0',
  card: '#FFFEF9',
  border: '#E6D5B8',
  primary: '#3E2723',
  primaryLight: '#EFE1C8',
  accent: '#C9A86A',
  gold: '#C9A86A',
  goldLight: '#F5E6C8',
  textPrimary: '#3E2723',
  textSecondary: '#8D7A64',
  textGold: '#D4C5A0',
  verseNum: '#C9A86A',
  verseHighlight: 'rgba(201,168,106,0.22)',
  verseHighlightBorder: 'rgba(201,168,106,0.45)',
  shadow: 'rgba(62,39,35,0.12)',
  statusBar: 'dark',
};

export const Dark = {
  mode: 'night',
  background: '#0A0A0A',
  background2: '#141210',
  parchment: '#151310',
  parchmentDark: '#1E1B17',
  card: '#151310',
  border: '#2A251E',
  primary: '#D4C5A0',
  primaryLight: '#2A251E',
  accent: '#C9A86A',
  gold: '#C9A86A',
  goldLight: 'rgba(201,168,106,0.15)',
  textPrimary: '#D4C5A0',
  textSecondary: '#8C7F6B',
  textGold: '#D4C5A0',
  verseNum: '#C9A86A',
  verseHighlight: 'rgba(201,168,106,0.18)',
  verseHighlightBorder: 'rgba(201,168,106,0.35)',
  shadow: 'rgba(0,0,0,0.5)',
  statusBar: 'light',
};

// Real paper-Bible typography: EB Garamond for scripture (a classic printed-Bible
// serif), Inter for UI chrome. Loaded via expo-font in App.js before the app
// renders (see App.js), so these family names are guaranteed available here.
const fonts = {
  serif: 'EBGaramond_400Regular',
  serifItalic: 'EBGaramond_400Regular_Italic',
  serifSemi: 'EBGaramond_600SemiBold',
  serifBold: 'EBGaramond_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  fallbackSerif: 'serif',
  fallbackSans: 'sans-serif',
};

const ThemeContext = createContext({ colors: Light, fonts, isDark: false, toggleTheme: ()=>{} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('theme_mode');
      if (saved) setIsDark(saved === 'dark');
      else setIsDark(Appearance.getColorScheme() === 'dark');
    })();
  }, []);
  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('theme_mode', next ? 'dark' : 'light');
  };
  const colors = isDark ? Dark : Light;
  return <ThemeContext.Provider value={{ colors, fonts, isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
