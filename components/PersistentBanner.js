import React, { useEffect, useRef, useState } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
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

// No-fill retry back-off: 30s, 60s, 120s … capped at 5 min.
const RETRY_BASE_MS = 30 * 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;

/**
 * The ONE app-wide anchored adaptive banner. It is mounted once at the root
 * (between the bottom dock and the system navigation inset), so it is never
 * torn down and re-requested on every screen change — AdMob's own refresh
 * cycle controls it, which is what the anchored-banner format expects.
 *
 * It waits for consent/initialisation before requesting. Until an ad has
 * actually filled it takes no space at all (no empty strip), and on no-fill
 * it quietly retries with back-off.
 */
export default function PersistentBanner() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(AdManager.isInitialized);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const timer = useRef(null);
  const failures = useRef(0);

  useEffect(() => AdManager.onReady(() => setReady(true)), []);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!BannerAd || !ready) return null;

  return (
    <View
      style={{
        width: '100%',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderTopWidth: loaded ? 1 : 0,
        borderTopColor: colors.border,
        // Collapsed (but still mounted, so the request runs) until filled.
        height: loaded ? undefined : 0,
        overflow: 'hidden',
      }}
    >
      <BannerAd
        key={attempt}
        unitId={getBannerId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        width={Math.floor(width)}
        requestOptions={getRequestOptions()}
        onAdLoaded={() => {
          failures.current = 0;
          setLoaded(true);
        }}
        onAdFailedToLoad={(e) => {
          console.log('[Ads] Banner failed to load:', e?.code || '', e?.message || e);
          setLoaded(false);
          const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** failures.current);
          failures.current += 1;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setAttempt((n) => n + 1), delay);
        }}
      />
    </View>
  );
}
