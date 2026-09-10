import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AD_UNIT_IDS, REQUEST_OPTIONS, USE_TEST_ADS } from '../constants/ads';

let mobileAds = null;
let InterstitialAd = null;
let RewardedAd = null;
let AdEventType = null;
let RewardedAdEventType = null;
let BannerAdSize = null;

if (Platform.OS !== 'web') {
  try {
    const ads = require('react-native-google-mobile-ads');
    mobileAds = ads.default;
    InterstitialAd = ads.InterstitialAd;
    RewardedAd = ads.RewardedAd;
    AdEventType = ads.AdEventType;
    RewardedAdEventType = ads.RewardedAdEventType;
    BannerAdSize = ads.BannerAdSize;
  } catch (e) {
    console.log('[Ads] SDK not available in this runtime:', e?.message);
  }
}

// Audio unlock: a single rewarded-ad watch unlocks read-aloud everywhere in
// the app (every book/chapter/verse checks this same global key) for exactly
// 1 hour.
const AUDIO_UNLOCK_KEY = '@audio_unlock_until';
const AUDIO_UNLOCK_MS = 60 * 60 * 1000; // 1 hour, exactly

// Interstitial pacing: never more than once every 4 minutes, and only after
// the reader has taken several actions (or at an explicit natural break —
// leaving a chapter, opening a new book, finishing a share) — keeps
// interstitials occasional and never mid-reading, even across a long
// session.
const INTERSTITIAL_COOLDOWN_MS = 4 * 60 * 1000;
const MIN_INTERACTIONS_BEFORE_AD = 5;

// Retry backoff for a failed ad load, so a single no-fill doesn't permanently
// disable interstitials/rewarded for the rest of the session.
const RELOAD_BACKOFF_MS = 30 * 1000;

class AdManagerClass {
  constructor() {
    this.isInitialized = false;
    this.interstitial = null;
    this.interstitialLoaded = false;
    this.interstitialLoading = false;
    this.rewarded = null;
    this.rewardedLoaded = false;
    this.rewardedLoading = false;
    this.lastInterstitialAt = 0;
    this.interactionCount = 0;
  }

  async init() {
    if (this.isInitialized) return;
    if (!mobileAds) {
      console.log('[Ads] Skipping init — native ads SDK is not available in this runtime (e.g. running in Expo Go instead of a dev-client/EAS build).');
      return;
    }
    try {
      await mobileAds().initialize();
      mobileAds().setRequestConfiguration({
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      this.isInitialized = true;
      this._loadInterstitial();
      this._loadRewarded();
      console.log('[Ads] Initialized. Test ads:', USE_TEST_ADS);
    } catch (e) {
      console.log('[Ads] init failed:', e?.message);
    }
  }

  // ---------------- Interstitial ----------------

  _loadInterstitial() {
    if (!InterstitialAd || this.interstitialLoading) return;
    this.interstitialLoading = true;
    try {
      const ad = InterstitialAd.createForAdRequest(AD_UNIT_IDS.INTERSTITIAL, REQUEST_OPTIONS);
      this.interstitialLoaded = false;
      let settled = false;
      const cleanup = () => { unsubLoaded(); unsubClosed(); unsubError(); };
      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        settled = true;
        this.interstitialLoading = false;
        this.interstitialLoaded = true;
      });
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.interstitialLoaded = false;
        this.interstitialLoading = false;
        cleanup();
        this._loadInterstitial();
      });
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
        settled = true;
        this.interstitialLoaded = false;
        this.interstitialLoading = false;
        cleanup();
        setTimeout(() => this._loadInterstitial(), RELOAD_BACKOFF_MS);
      });
      ad.load();
      this.interstitial = ad;
      // Safety net: some SDK versions never fire an event on certain
      // failures. If nothing happened within 15s, allow a retry.
      setTimeout(() => {
        if (!settled && this.interstitialLoading) {
          this.interstitialLoading = false;
        }
      }, 15000);
    } catch (e) {
      this.interstitialLoading = false;
      console.log('[Ads] interstitial load failed:', e?.message);
    }
  }

  /**
   * Call at natural transition points (leaving a chapter, opening a new
   * book, finishing a search, etc). Respects a cooldown and a minimum
   * interaction count so it never interrupts an ongoing reading session.
   * `isNaturalBreak: true` skips the interaction-count requirement (still
   * respects the cooldown) for especially natural moments like navigating
   * back out of a chapter.
   */
  tryShowInterstitial({ isNaturalBreak = false } = {}) {
    this.interactionCount++;
    const now = Date.now();
    if (now - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return false;
    if (!isNaturalBreak && this.interactionCount < MIN_INTERACTIONS_BEFORE_AD) return false;
    if (!this.interstitial || !this.interstitialLoaded) return false;

    try {
      this.interstitial.show();
      this.lastInterstitialAt = now;
      this.interactionCount = 0;
      return true;
    } catch (e) {
      console.log('[Ads] interstitial show failed:', e?.message);
      return false;
    }
  }

  // ---------------- Rewarded (unlocks audio, globally) ----------------

  _loadRewarded() {
    if (!RewardedAd || this.rewardedLoading) return;
    this.rewardedLoading = true;
    console.log('[Ads] Requesting a rewarded ad...');
    try {
      const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS.REWARDED, {
        ...REQUEST_OPTIONS,
        keywords: ['bible', 'faith', 'religion', 'devotional'],
      });
      this.rewardedLoaded = false;
      let settled = false;
      const cleanup = () => { unsubLoaded(); unsubClosed(); unsubError(); };
      const markLoaded = (source) => {
        if (this.rewardedLoaded) return; // already handled by the other listener
        settled = true;
        this.rewardedLoading = false;
        this.rewardedLoaded = true;
        console.log(`[Ads] Rewarded ad ready (via ${source}).`);
      };
      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => markLoaded('RewardedAdEventType.LOADED'));
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (e) => {
        settled = true;
        this.rewardedLoaded = false;
        this.rewardedLoading = false;
        console.log('[Ads] Rewarded ad failed to load:', e?.message || e);
        cleanup();
        setTimeout(() => this._loadRewarded(), RELOAD_BACKOFF_MS);
      });
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.rewardedLoaded = false;
        this.rewardedLoading = false;
        cleanup();
        this._loadRewarded();
      });
      ad.load();
      this.rewarded = ad;
      setTimeout(() => {
        if (!settled && this.rewardedLoading) {
          console.log('[Ads] Rewarded ad load timed out after 15s with no LOADED/ERROR event — resetting to allow a fresh attempt.');
          this.rewardedLoading = false;
        }
      }, 15000);
    } catch (e) {
      this.rewardedLoading = false;
      console.log('[Ads] rewarded load failed:', e?.message);
    }
  }

  isRewardedReady() {
    return !!this.rewardedLoaded;
  }

  /**
   * Waits for a rewarded ad to finish loading if one isn't ready yet
   * (common right after app launch, or right after the previous one was
   * just watched and a replacement is still loading), instead of failing
   * instantly. If nothing has happened by the time we'd give up, forces one
   * more fresh load attempt rather than silently staying stuck — this is
   * what makes the reward-for-audio flow reliable across a whole session,
   * not just the first time.
   */
  async _waitForRewardedReady(timeoutMs = 8000) {
    if (this.rewardedLoaded) return true;
    if (!this.rewardedLoading) this._loadRewarded();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.rewardedLoaded) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!this.rewardedLoaded) {
      console.log('[Ads] Rewarded ad still not ready after', timeoutMs, 'ms — forcing a retry.');
      this.rewardedLoading = false;
      this._loadRewarded();
    }
    return this.rewardedLoaded;
  }

  /**
   * Shows the rewarded ad. Resolves `true` only if the reward was actually
   * earned (and audio has been unlocked globally for an hour); `false`
   * otherwise (no fill, user dismissed early, or SDK unavailable here).
   */
  async showRewarded() {
    if (!RewardedAd) {
      console.log('[Ads] showRewarded: SDK unavailable on this runtime.');
      return false;
    }
    console.log('[Ads] showRewarded: rewardedLoaded =', this.rewardedLoaded, ', rewardedLoading =', this.rewardedLoading);
    const ready = await this._waitForRewardedReady();
    if (!ready || !this.rewarded) {
      console.log('[Ads] showRewarded: no rewarded ad became ready in time.');
      return false;
    }

    return new Promise((resolve) => {
      let earned = false;
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        unsubEarned();
        unsubClosed();
        resolve(result);
      };
      const unsubEarned = this.rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
        earned = true;
        console.log('[Ads] Reward earned — unlocking audio.');
        await this.unlockAudio();
      });
      const unsubClosed = this.rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[Ads] Rewarded ad closed. Earned:', earned);
        finish(earned);
      });
      try {
        this.rewarded.show();
        console.log('[Ads] Rewarded ad show() called.');
      } catch (e) {
        console.log('[Ads] rewarded show failed:', e?.message);
        finish(false);
      }
    });
  }

  async unlockAudio() {
    const until = Date.now() + AUDIO_UNLOCK_MS;
    await AsyncStorage.setItem(AUDIO_UNLOCK_KEY, String(until));
    return until;
  }

  /** Global, app-wide check — works identically from any book/chapter/verse. */
  async isAudioUnlocked() {
    try {
      const until = await AsyncStorage.getItem(AUDIO_UNLOCK_KEY);
      return !!until && Date.now() < parseInt(until, 10);
    } catch {
      return false;
    }
  }

  async audioUnlockedUntil() {
    try {
      const until = await AsyncStorage.getItem(AUDIO_UNLOCK_KEY);
      return until ? parseInt(until, 10) : 0;
    } catch {
      return 0;
    }
  }

  // ---------------- IDs ----------------

  getBannerId() {
    return AD_UNIT_IDS.BANNER;
  }

  getNativeId() {
    return AD_UNIT_IDS.NATIVE;
  }
}

export const AdManager = new AdManagerClass();

export const initAds = () => AdManager.init();
export const showRewarded = () => AdManager.showRewarded();
export const tryShowInterstitial = (opts) => AdManager.tryShowInterstitial(opts);
export const isAudioUnlocked = () => AdManager.isAudioUnlocked();
export const getBannerId = () => AdManager.getBannerId();
export const getNativeId = () => AdManager.getNativeId();
export { BannerAdSize };

export default AdManager;
