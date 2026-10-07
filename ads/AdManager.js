import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AD_UNIT_IDS, USE_TEST_ADS, getRequestOptions, setNonPersonalizedOnly } from '../constants/ads';

// ---------------------------------------------------------------------------
// SDK bindings (guarded so the JS bundle still runs in Expo Go / web, where
// the native module does not exist — every ad call simply becomes a no-op).
// ---------------------------------------------------------------------------
let mobileAds = null;
let InterstitialAd = null;
let RewardedAd = null;
let RewardedInterstitialAd = null;
let AppOpenAd = null;
let AdEventType = null;
let RewardedAdEventType = null;
let AdsConsent = null;
let AdsConsentStatus = null;
let AdsConsentPrivacyOptionsRequirementStatus = null;
let BannerAdSize = null;

if (Platform.OS !== 'web') {
  try {
    const ads = require('react-native-google-mobile-ads');
    mobileAds = ads.default;
    InterstitialAd = ads.InterstitialAd;
    RewardedAd = ads.RewardedAd;
    RewardedInterstitialAd = ads.RewardedInterstitialAd;
    AppOpenAd = ads.AppOpenAd;
    AdEventType = ads.AdEventType;
    RewardedAdEventType = ads.RewardedAdEventType;
    AdsConsent = ads.AdsConsent;
    AdsConsentStatus = ads.AdsConsentStatus;
    AdsConsentPrivacyOptionsRequirementStatus = ads.AdsConsentPrivacyOptionsRequirementStatus;
    BannerAdSize = ads.BannerAdSize;
  } catch (e) {
    console.log('[Ads] SDK not available in this runtime:', e?.message);
  }
}

// Audio unlock: one rewarded watch unlocks read-aloud everywhere for 1 hour.
const AUDIO_UNLOCK_KEY = '@audio_unlock_until';
const AUDIO_UNLOCK_MS = 60 * 60 * 1000;

// If no rewarded ad is available, the user is never locked out: audio is
// granted for a short grace period instead (no-fill must not block a feature).
const AUDIO_GRACE_MS = 15 * 60 * 1000;

// Interstitial pacing — occasional, only at natural breaks, never mid-session.
const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_INTERACTIONS_BEFORE_AD = 6;
const SESSION_GRACE_MS = 2 * 60 * 1000; // no interstitial in the first 2 min
const CONSENT_TIMEOUT_MS = 8 * 1000;

// App-open pacing (Google guidance: show on foreground, not too often, and
// discard an ad that has been cached for more than 4 hours).
const APP_OPEN_MIN_BACKGROUND_MS = 30 * 1000;
const APP_OPEN_COOLDOWN_MS = 3 * 60 * 1000;
const APP_OPEN_EXPIRY_MS = 4 * 60 * 60 * 1000;
const LAUNCH_COUNT_KEY = '@launch_count';

const RELOAD_BACKOFF_MS = 30 * 1000;
const LOAD_TIMEOUT_MS = 20 * 1000;

/**
 * One reusable "slot" per full-screen format. It owns exactly one ad object
 * at a time, loads it ahead of time, retries with back-off on no-fill, and
 * reloads automatically after it is shown. All four full-screen formats
 * (interstitial, rewarded, rewarded interstitial, app open) share this code,
 * so they all behave identically and predictably.
 */
class FullScreenSlot {
  constructor({ name, create, loadedEvent, isRewarded = false }) {
    this.name = name;
    this.create = create;
    this.loadedEvent = loadedEvent;
    this.isRewarded = isRewarded;
    this.ad = null;
    this.loaded = false;
    this.loading = false;
    this.loadedAt = 0;
    this.unsubs = [];
    this.retryTimer = null;
  }

  _clear() {
    this.unsubs.forEach((u) => { try { u(); } catch {} });
    this.unsubs = [];
  }

  load() {
    if (this.loading || this.loaded) return;
    if (!this.create) return;
    this.loading = true;
    let ad;
    try {
      ad = this.create();
    } catch (e) {
      this.loading = false;
      console.log(`[Ads] ${this.name}: create failed:`, e?.message);
      return;
    }
    this._clear();
    let settled = false;
    this.unsubs.push(ad.addAdEventListener(this.loadedEvent, () => {
      settled = true;
      this.loading = false;
      this.loaded = true;
      this.loadedAt = Date.now();
      console.log(`[Ads] ${this.name}: loaded`);
    }));
    this.unsubs.push(ad.addAdEventListener(AdEventType.ERROR, (err) => {
      settled = true;
      this.loading = false;
      this.loaded = false;
      console.log(`[Ads] ${this.name}: failed to load —`, err?.code || '', err?.message || err);
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.load(), RELOAD_BACKOFF_MS);
    }));
    this.ad = ad;
    try {
      ad.load();
    } catch (e) {
      this.loading = false;
      console.log(`[Ads] ${this.name}: load() threw:`, e?.message);
      return;
    }
    setTimeout(() => {
      if (!settled && this.loading) {
        console.log(`[Ads] ${this.name}: load timed out, allowing a fresh attempt.`);
        this.loading = false;
      }
    }, LOAD_TIMEOUT_MS);
  }

  isReady(maxAgeMs = 0) {
    if (!this.loaded || !this.ad) return false;
    if (maxAgeMs && Date.now() - this.loadedAt > maxAgeMs) {
      this.loaded = false;
      this.load();
      return false;
    }
    return true;
  }

  async waitUntilReady(timeoutMs = 8000) {
    if (this.loaded) return true;
    this.load();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.loaded) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!this.loaded) {
      this.loading = false;
      this.load();
    }
    return this.loaded;
  }

  /** Shows the ad. Resolves { shown, earned } once the ad is dismissed. */
  show(onOpen, onClose) {
    if (!this.isReady()) return Promise.resolve({ shown: false, earned: false });
    const ad = this.ad;
    return new Promise((resolve) => {
      let earned = false;
      let done = false;
      const local = [];
      const finish = (shown) => {
        if (done) return;
        done = true;
        local.forEach((u) => { try { u(); } catch {} });
        this.loaded = false;
        this.loading = false;
        onClose && onClose();
        resolve({ shown, earned });
        this.load(); // pre-load the next one
      };
      if (this.isRewarded) {
        local.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
      }
      local.push(ad.addAdEventListener(AdEventType.OPENED, () => { onOpen && onOpen(); }));
      local.push(ad.addAdEventListener(AdEventType.CLOSED, () => finish(true)));
      // A failure to *show* also arrives as ERROR — resolve instead of hanging.
      local.push(ad.addAdEventListener(AdEventType.ERROR, () => finish(false)));
      try {
        ad.show();
      } catch (e) {
        console.log(`[Ads] ${this.name}: show failed:`, e?.message);
        finish(false);
      }
    });
  }
}

class AdManagerClass {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
    this.readyListeners = new Set();
    this.lastFullScreenAt = 0;
    this.lastInterstitialAt = 0;
    this.interactionCount = 0;
    this.fullScreenShowing = false;
    this.backgroundedAt = 0;
    this.appState = AppState.currentState;
    this.launchCount = 0;
    this.privacyOptionsRequired = false;
    this.sessionStartedAt = Date.now();
    // Reasons the user is actively engaged (e.g. 'audio'). While any is set,
    // no full-screen ad (interstitial / app open) may appear.
    this.busy = new Set();

    const opts = () => getRequestOptions();
    this.interstitial = new FullScreenSlot({
      name: 'Interstitial',
      create: InterstitialAd ? () => InterstitialAd.createForAdRequest(AD_UNIT_IDS.INTERSTITIAL, opts()) : null,
      loadedEvent: AdEventType?.LOADED,
    });
    this.rewarded = new FullScreenSlot({
      name: 'Rewarded',
      create: RewardedAd ? () => RewardedAd.createForAdRequest(AD_UNIT_IDS.REWARDED, opts()) : null,
      loadedEvent: RewardedAdEventType?.LOADED,
      isRewarded: true,
    });
    this.rewardedInterstitial = new FullScreenSlot({
      name: 'RewardedInterstitial',
      create: RewardedInterstitialAd ? () => RewardedInterstitialAd.createForAdRequest(AD_UNIT_IDS.REWARDED_INTERSTITIAL, opts()) : null,
      loadedEvent: RewardedAdEventType?.LOADED,
      isRewarded: true,
    });
    this.appOpen = new FullScreenSlot({
      name: 'AppOpen',
      create: AppOpenAd ? () => AppOpenAd.createForAdRequest(AD_UNIT_IDS.APP_OPEN, opts()) : null,
      loadedEvent: AdEventType?.LOADED,
    });
  }

  // ---------------- Lifecycle ----------------

  init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  async _init() {
    if (!mobileAds) {
      console.log('[Ads] Skipping init — native SDK unavailable (Expo Go / web).');
      return false;
    }
    try {
      const n = parseInt((await AsyncStorage.getItem(LAUNCH_COUNT_KEY)) || '0', 10) + 1;
      this.launchCount = n;
      AsyncStorage.setItem(LAUNCH_COUNT_KEY, String(n)).catch(() => {});
    } catch {}

    // 1) Consent first (GDPR / US-state privacy via Google UMP). Ads are only
    //    requested once the SDK says we may.
    let canRequestAds = true;
    if (AdsConsent) {
      try {
        // Never let a slow/hung consent request stop ads (incl. the banner)
        // from ever starting.
        const info = await Promise.race([
          AdsConsent.gatherConsent(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('consent timeout')), CONSENT_TIMEOUT_MS)),
        ]);
        canRequestAds = info?.canRequestAds !== false;
        this.privacyOptionsRequired =
          info?.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus?.REQUIRED;
        // If consent is required but the user has not granted it, stay with
        // non-personalised requests.
        if (info?.status === AdsConsentStatus?.REQUIRED) setNonPersonalizedOnly(true);
      } catch (e) {
        // No consent message configured in AdMob, or offline — ads can still
        // be requested; Google serves accordingly.
        console.log('[Ads] Consent step skipped:', e?.message);
      }
    }
    if (!canRequestAds) {
      console.log('[Ads] Consent not given — ads will not be requested this session.');
      return false;
    }

    // 2) Initialise the SDK and pre-load every full-screen format.
    try {
      // Request configuration must be set BEFORE initialize() to apply.
      await mobileAds().setRequestConfiguration({
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      await mobileAds().initialize();
    } catch (e) {
      console.log('[Ads] initialize failed:', e?.message);
    }
    this.isInitialized = true;
    this.interstitial.load();
    this.rewarded.load();
    this.rewardedInterstitial.load();
    this.appOpen.load();
    this.readyListeners.forEach((fn) => { try { fn(); } catch {} });
    this.readyListeners.clear();
    console.log('[Ads] Initialized. Test ads:', USE_TEST_ADS);

    this._watchAppState();
    this._maybeShowColdStartAppOpen();
    return true;
  }

  /** Banner & native components wait for this so nothing is requested before consent. */
  onReady(fn) {
    if (this.isInitialized) { fn(); return () => {}; }
    this.readyListeners.add(fn);
    return () => this.readyListeners.delete(fn);
  }

  // ---------------- Full-screen coordination ----------------

  /** Mark the user as actively engaged (e.g. audio playing) so nothing interrupts. */
  setBusy(reason, on) {
    if (on) this.busy.add(reason); else this.busy.delete(reason);
  }

  isBusy() {
    return this.busy.size > 0;
  }

  _beforeFullScreen() {
    this.fullScreenShowing = true;
  }

  _afterFullScreen() {
    this.fullScreenShowing = false;
    this.lastFullScreenAt = Date.now();
  }

  // ---------------- App open ----------------

  _watchAppState() {
    if (this._appStateSub) return;
    this._appStateSub = AppState.addEventListener('change', (next) => {
      const prev = this.appState;
      this.appState = next;
      if (next === 'background') {
        this.backgroundedAt = Date.now();
      }
      if (prev && prev.match(/inactive|background/) && next === 'active') {
        const awayFor = this.backgroundedAt ? Date.now() - this.backgroundedAt : 0;
        if (awayFor >= APP_OPEN_MIN_BACKGROUND_MS) this.showAppOpen();
      }
    });
  }

  async _maybeShowColdStartAppOpen() {
    // Never on a first-ever launch (bad first impression); afterwards, only if
    // an ad is ready within a few seconds of launch.
    if (this.launchCount < 2) return;
    const ok = await this.appOpen.waitUntilReady(4000);
    if (ok && this.appState === 'active') this.showAppOpen();
  }

  async showAppOpen() {
    if (this.fullScreenShowing || this.isBusy()) return false;
    if (Date.now() - this.lastFullScreenAt < APP_OPEN_COOLDOWN_MS) return false;
    if (!this.appOpen.isReady(APP_OPEN_EXPIRY_MS)) { this.appOpen.load(); return false; }
    const { shown } = await this.appOpen.show(() => this._beforeFullScreen(), () => this._afterFullScreen());
    return shown;
  }

  // ---------------- Interstitial ----------------

  /**
   * Every call counts as an interaction, but an ad is only ever shown when
   * the caller marks a genuine natural break (leaving the reader, finishing
   * a plan reading, after sharing) — never on ordinary navigation, never
   * while audio plays, never early in a session, and at most every 5 min.
   */
  tryShowInterstitial({ isNaturalBreak = false } = {}) {
    this.interactionCount++;
    const now = Date.now();
    if (!isNaturalBreak) return false;
    if (this.fullScreenShowing || this.isBusy()) return false;
    if (now - this.sessionStartedAt < SESSION_GRACE_MS) return false;
    if (now - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return false;
    if (now - this.lastFullScreenAt < 60 * 1000) return false;
    if (this.interactionCount < MIN_INTERACTIONS_BEFORE_AD) return false;
    if (!this.interstitial.isReady()) { this.interstitial.load(); return false; }
    this.lastInterstitialAt = now;
    this.interactionCount = 0;
    this.interstitial.show(() => this._beforeFullScreen(), () => this._afterFullScreen());
    return true;
  }

  // ---------------- Rewarded (unlocks audio) ----------------

  isRewardedReady() {
    return this.rewarded.isReady() || this.rewardedInterstitial.isReady();
  }

  /**
   * Shows a rewarded ad for the audio unlock. Falls back to the rewarded
   * interstitial unit if the rewarded unit has no fill, so the user almost
   * always gets an ad to unlock with. Resolves true only if earned.
   */
  async showRewarded() {
    if (!this.rewarded.create && !this.rewardedInterstitial.create) return false;
    let slot = null;
    if (await this.rewarded.waitUntilReady(6000)) slot = this.rewarded;
    else if (await this.rewardedInterstitial.waitUntilReady(3000)) slot = this.rewardedInterstitial;
    this.lastRewardedShown = false;
    if (!slot) {
      console.log('[Ads] showRewarded: nothing ready in time.');
      return false;
    }
    const { shown, earned } = await slot.show(() => this._beforeFullScreen(), () => this._afterFullScreen());
    this.lastRewardedShown = shown;
    if (earned) await this.unlockAudio();
    return earned;
  }

  // ---------------- Rewarded interstitial (unlocks AI sermons) ----------------

  /**
   * Shows the rewarded interstitial (used after the user has opted in via the
   * in-app intro sheet). Resolves { shown, earned }. If no ad is available the
   * caller should still give the user their content — no-fill must never
   * block a feature.
   */
  async showRewardedInterstitial() {
    if (!this.rewardedInterstitial.create) return { shown: false, earned: false };
    const ready = await this.rewardedInterstitial.waitUntilReady(5000);
    if (!ready) return { shown: false, earned: false };
    return this.rewardedInterstitial.show(() => this._beforeFullScreen(), () => this._afterFullScreen());
  }

  // ---------------- Audio unlock state ----------------

  /** Short unlock used when no rewarded ad could be loaded. */
  async grantAudioGrace() {
    const until = Date.now() + AUDIO_GRACE_MS;
    await AsyncStorage.setItem(AUDIO_UNLOCK_KEY, String(until));
    return until;
  }

  async unlockAudio() {
    const until = Date.now() + AUDIO_UNLOCK_MS;
    await AsyncStorage.setItem(AUDIO_UNLOCK_KEY, String(until));
    return until;
  }

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

  // ---------------- Privacy ----------------

  isPrivacyOptionsRequired() {
    return this.privacyOptionsRequired;
  }

  async showPrivacyOptions() {
    if (!AdsConsent) return false;
    try {
      await AdsConsent.showPrivacyOptionsForm();
      return true;
    } catch (e) {
      console.log('[Ads] privacy options failed:', e?.message);
      return false;
    }
  }

  // ---------------- IDs ----------------

  getBannerId() { return AD_UNIT_IDS.BANNER; }
  getNativeId() { return AD_UNIT_IDS.NATIVE; }
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
