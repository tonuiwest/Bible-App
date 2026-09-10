import { TestIds } from 'react-native-google-mobile-ads';

// Use Google's official test units in dev so nobody accidentally taps/serves
// real ads while developing. Real unit IDs are only ever used in a release build.
export const USE_TEST_ADS = __DEV__;

export const APP_ID = 'ca-app-pub-7561161015961675~8874760537';

const REAL = {
  BANNER: 'ca-app-pub-7561161015961675/6632260093',
  INTERSTITIAL: 'ca-app-pub-7561161015961675/7777820801',
  NATIVE: 'ca-app-pub-7561161015961675/3370554313',
  REWARDED: 'ca-app-pub-7561161015961675/3565613596',
};

const TEST = {
  BANNER: TestIds.BANNER,
  INTERSTITIAL: TestIds.INTERSTITIAL,
  NATIVE: TestIds.NATIVE,
  REWARDED: TestIds.REWARDED,
};

export const AD_UNIT_IDS = {
  APP_ID,
  BANNER: USE_TEST_ADS ? TEST.BANNER : REAL.BANNER,
  INTERSTITIAL: USE_TEST_ADS ? TEST.INTERSTITIAL : REAL.INTERSTITIAL,
  NATIVE: USE_TEST_ADS ? TEST.NATIVE : REAL.NATIVE,
  REWARDED: USE_TEST_ADS ? TEST.REWARDED : REAL.REWARDED,
};

// Non-personalized by default; keeps the app compliant out of the box even
// before a consent flow is wired up for a given region.
export const REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
};

export default { AD_UNIT_IDS, REQUEST_OPTIONS, USE_TEST_ADS, APP_ID };
