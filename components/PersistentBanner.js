import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { getBannerId } from '../ads/AdManager';

let BannerAd = null;
let BannerAdSize = null;
if (Platform.OS !== 'web') {
  try {
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
  } catch (e) {
    // SDK unavailable (e.g. Expo Go) — the banner simply won't render.
  }
}

/**
 * Always docked to the very bottom of the screen. Renders nothing (instead
 * of a broken placeholder) if the ad fails to load, so it never disrupts
 * the reading layout.
 */
export default function PersistentBanner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  if (!BannerAd || failed) return null;

  return (
    <View
      style={{
        width: '100%',
        alignItems: 'center',
        backgroundColor: colors?.card || '#FFFEF9',
        borderTopWidth: 1,
        borderTopColor: colors?.border || '#E6D5B8',
        paddingBottom: insets.bottom,
      }}
    >
      <BannerAd
        unitId={getBannerId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
