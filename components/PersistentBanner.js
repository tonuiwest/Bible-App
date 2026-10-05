import React, { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { AdManager, getBannerId } from '../ads/AdManager';
import { getRequestOptions } from '../constants/ads';

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

const RETRY_MS = 60 * 1000;

/**
 * The ONE app-wide anchored adaptive banner. It is mounted once at the root
 * (below the navigation stack and the bottom dock), so it is never torn down
 * and re-requested on every screen change — AdMob's own refresh cycle
 * controls it, which is what the anchored-banner format expects.
 *
 * It waits for consent/initialisation before requesting, collapses to zero
 * height when there is no fill, and quietly retries a minute later.
 */
export default function PersistentBanner() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(AdManager.isInitialized);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const timer = useRef(null);

  useEffect(() => AdManager.onReady(() => setReady(true)), []);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!BannerAd || !ready) return null;

  return (
    <View
      style={{
        width: '100%',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderTopWidth: failed ? 0 : 1,
        borderTopColor: colors.border,
        height: failed ? 0 : undefined,
        overflow: 'hidden',
      }}
    >
      <BannerAd
        key={attempt}
        unitId={getBannerId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={getRequestOptions()}
        onAdLoaded={() => setFailed(false)}
        onAdFailedToLoad={(e) => {
          console.log('[Ads] Banner failed to load:', e?.code || '', e?.message || e);
          setFailed(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setAttempt((n) => n + 1), RETRY_MS);
        }}
      />
    </View>
  );
}
