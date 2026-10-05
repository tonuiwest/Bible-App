import { TestIds } from 'react-native-google-mobile-ads';

// Google's official test units are used in development builds so nobody
// accidentally taps or serves real ads while developing. Release builds
// (__DEV__ === false) always use the real units below.
export const USE_TEST_ADS = __DEV__;

export const APP_ID = 'ca-app-pub-7561161015961675~8874760537';

const REAL = {
  BANNER: 'ca-app-pub-7561161015961675/6632260093',
  INTERSTITIAL: 'ca-app-pub-7561161015961675/7777820801',
  NATIVE: 'ca-app-pub-7561161015961675/3370554313',
  REWARDED: 'ca-app-pub-7561161015961675/3565613596',
  REWARDED_INTERSTITIAL: 'ca-app-pub-7561161015961675/8437847426',
  APP_OPEN: 'ca-app-pub-7561161015961675/7664745246',
};

const TEST = {
  BANNER: TestIds.ADAPTIVE_BANNER || TestIds.BANNER,
  INTERSTITIAL: TestIds.INTERSTITIAL,
  NATIVE: TestIds.NATIVE,
  REWARDED: TestIds.REWARDED,
  REWARDED_INTERSTITIAL: TestIds.REWARDED_INTERSTITIAL,
  APP_OPEN: TestIds.APP_OPEN,
};

const SRC = USE_TEST_ADS ? TEST : REAL;

export const AD_UNIT_IDS = {
  APP_ID,
  BANNER: SRC.BANNER,
  INTERSTITIAL: SRC.INTERSTITIAL,
  NATIVE: SRC.NATIVE,
  REWARDED: SRC.REWARDED,
  REWARDED_INTERSTITIAL: SRC.REWARDED_INTERSTITIAL,
  APP_OPEN: SRC.APP_OPEN,
};

// Personalisation is decided by Google's consent flow (UMP), which runs in
// AdManager.init() before any ad is requested. When a user in a regulated
// region declines, the SDK automatically serves non-personalised ads via the
// stored TCF string — so we no longer force non-personalised ads for
// everyone (that was costing revenue in every other region).
let npaOnly = false;
export function setNonPersonalizedOnly(value) {
  npaOnly = !!value;
}
export function getRequestOptions(extra = {}) {
  return {
    requestNonPersonalizedAdsOnly: npaOnly,
    keywords: ['bible', 'faith', 'christian', 'devotional', 'prayer'],
    ...extra,
  };
}

export default { AD_UNIT_IDS, USE_TEST_ADS, APP_ID, getRequestOptions };
