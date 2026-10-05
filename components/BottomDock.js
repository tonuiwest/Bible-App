import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions, StackActions } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import PersistentBanner from './PersistentBanner';
import { AdManager } from '../ads/AdManager';

// Which dock tab "owns" each route, so the right tab stays highlighted while
// drilling down (Library -> Chapters -> Verse keeps "Bible" lit).
const ROUTE_TO_TAB = {
  Home: 'Home',
  Books: 'Books', Chapters: 'Books', Verse: 'Books', Audio: 'Books', Search: 'Books',
  Planner: 'Planner', PlannerDetail: 'Planner', CreatePlan: 'Planner',
  AIQA: 'AIQA', Sermon: 'AIQA',
  Bookmarks: 'Bookmarks',
};

const LEFT = [
  { key: 'Books', label: 'Bible', icon: 'book-outline', active: 'book' },
  { key: 'Planner', label: 'Plans', icon: 'calendar-outline', active: 'calendar' },
];
const RIGHT = [
  { key: 'AIQA', label: 'Ask AI', icon: 'sparkles-outline', active: 'sparkles' },
  { key: 'Bookmarks', label: 'Saved', icon: 'bookmark-outline', active: 'bookmark' },
];

/**
 * App-wide bottom area, mounted once under the navigation stack:
 *
 *   [ Bible | Plans | (HOME) | Ask AI | Saved ]   <- persistent dock
 *   [            anchored banner ad           ]   <- persistent banner
 *   [          system nav / home indicator     ]
 *
 * The centre Home button is always visible on every screen and returns to
 * the Home page from anywhere in one tap.
 */
export default function BottomDock({ navigationRef, currentRoute }) {
  const { colors, fonts, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [kbVisible, setKbVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setKbVisible(true));
    const b = Keyboard.addListener(hideEvt, () => setKbVisible(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  const activeTab = ROUTE_TO_TAB[currentRoute] || null;

  const goHome = () => {
    const nav = navigationRef;
    if (!nav || !nav.isReady()) return;
    const state = nav.getRootState?.();
    if (state && state.routes && state.routes.length > 1) {
      nav.dispatch(StackActions.popToTop());
    } else if (currentRoute !== 'Home') {
      nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
    }
  };

  const goTab = (key) => {
    const nav = navigationRef;
    if (!nav || !nav.isReady()) return;
    if (currentRoute === key) return;
    AdManager.tryShowInterstitial();
    nav.dispatch(CommonActions.reset({ index: 1, routes: [{ name: 'Home' }, { name: key }] }));
  };

  const Item = ({ item }) => {
    const on = activeTab === item.key;
    return (
      <TouchableOpacity
        onPress={() => goTab(item.key)}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
      >
        <Ionicons name={on ? item.active : item.icon} size={21} color={on ? colors.gold : colors.textSecondary} />
        <Text style={{ fontSize: 10, marginTop: 3, color: on ? colors.gold : colors.textSecondary, fontFamily: on ? fonts.sansBold : fonts.sansMedium }}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const homeOn = activeTab === 'Home';

  return (
    // display:'none' (not unmount) while typing, so the banner is not
    // re-requested every time the keyboard opens.
    <View style={{ display: kbVisible ? 'none' : 'flex', backgroundColor: colors.card }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 58,
          paddingHorizontal: 6,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {LEFT.map((it) => <Item key={it.key} item={it} />)}

        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={goHome}
            accessibilityRole="button"
            accessibilityLabel="Home"
            activeOpacity={0.85}
            style={{
              marginTop: -26,
              width: 60,
              height: 60,
              borderRadius: 30,
              padding: 3,
              backgroundColor: colors.card,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.5 : 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={homeOn ? ['#E2C27E', '#B8914A'] : ['#D8B878', '#A88242']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={homeOn ? 'home' : 'home-outline'} size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={{ fontSize: 10, marginTop: 1, color: homeOn ? colors.gold : colors.textSecondary, fontFamily: homeOn ? fonts.sansBold : fonts.sansMedium }}>
            Home
          </Text>
        </View>

        {RIGHT.map((it) => <Item key={it.key} item={it} />)}
      </View>

      <PersistentBanner />
      <View style={{ height: insets.bottom, backgroundColor: colors.card }} />
    </View>
  );
}
