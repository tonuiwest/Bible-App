import React, { useCallback, useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_600SemiBold,
  EBGaramond_700Bold,
} from '@expo-google-fonts/eb-garamond';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { VersionProvider } from './context/VersionContext';
import { PlannerProvider } from './context/PlannerContext';
import { AdManager } from './ads/AdManager';

import HomeScreen from './screens/HomeScreen';
import BooksScreen from './screens/BooksScreen';
import ChaptersScreen from './screens/ChaptersScreen';
import VerseScreen from './screens/VerseScreen';
import SearchScreen from './screens/SearchScreen';
import BookmarksScreen from './screens/BookmarksScreen';
import AIQAScreen from './screens/AIQAScreen';
import SermonScreen from './screens/SermonScreen';
import PlannerScreen from './screens/PlannerScreen';
import PlannerDetailScreen from './screens/PlannerDetailScreen';

const Stack = createNativeStackNavigator();
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { isDark } = useTheme();
  return (
    <NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Books" component={BooksScreen} />
        <Stack.Screen name="Chapters" component={ChaptersScreen} />
        <Stack.Screen name="Verse" component={VerseScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
        <Stack.Screen name="AIQA" component={AIQAScreen} />
        <Stack.Screen name="Sermon" component={SermonScreen} />
        <Stack.Screen name="Planner" component={PlannerScreen} />
        <Stack.Screen name="PlannerDetail" component={PlannerDetailScreen} />
        <Stack.Screen name="Audio" component={VerseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_600SemiBold,
    EBGaramond_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    AdManager.init();
  }, []);

  const onLayout = useCallback(async () => {
    if (fontsLoaded && !ready) {
      setReady(true);
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, ready]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#F9F1E7' }} />;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <ThemeProvider>
          <VersionProvider>
            <PlannerProvider>
              <RootNavigator />
            </PlannerProvider>
          </VersionProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}
