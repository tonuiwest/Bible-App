import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Platform, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getNativeId } from '../ads/AdManager';

let NativeAd = null;
let NativeAdView = null;
let NativeAsset = null;
let NativeAssetType = null;
let NativeMediaView = null;
if (Platform.OS !== 'web') {
  try {
    const ads = require('react-native-google-mobile-ads');
    NativeAd = ads.NativeAd;
    NativeAdView = ads.NativeAdView;
    NativeAsset = ads.NativeAsset;
    NativeAssetType = ads.NativeAssetType;
    NativeMediaView = ads.NativeMediaView;
  } catch (e) {
    // SDK unavailable (e.g. Expo Go) — the card simply won't render.
  }
}

/**
 * A native ad styled to sit naturally inside the parchment reading list.
 * Loads lazily and renders nothing at all (no placeholder box) until an ad
 * is actually ready, and disappears again if loading fails — so it never
 * leaves a broken or empty-looking gap in a "free space" of the layout.
 */
export default function NativeAdCard({ style }) {
  const { colors, fonts } = useTheme();
  const [nativeAd, setNativeAd] = useState(null);
  const requested = useRef(false);
  const adRef = useRef(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!NativeAd || requested.current) return;
    requested.current = true;
    let cancelled = false;
    NativeAd.createForAdRequest(getNativeId(), { requestNonPersonalizedAdsOnly: true })
      .then(ad => {
        if (cancelled) {
          // Screen was already gone by the time the ad arrived — release it
          // immediately instead of leaking native memory.
          ad?.destroy?.();
          return;
        }
        adRef.current = ad;
        setNativeAd(ad);
        // Fade in smoothly instead of popping in abruptly mid-scroll —
        // part of keeping it genuinely non-disruptive.
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      })
      .catch(() => { /* stay hidden */ });
    return () => {
      cancelled = true;
      // Native ad objects hold native-side resources (images, video, etc).
      // Destroying on unmount is what keeps repeated navigation (Home <->
      // Books <-> Chapters) from slowly leaking memory into a crash.
      adRef.current?.destroy?.();
      adRef.current = null;
    };
  }, []);

  if (!NativeAdView || !nativeAd) return null;

  return (
    <Animated.View style={[{
      backgroundColor: colors?.card || '#FFFEF9',
      borderWidth: 1,
      borderColor: colors?.border || '#E6D5B8',
      borderRadius: 14,
      padding: 12,
      marginVertical: 8,
      opacity,
    }, style]}>
      <Text style={{ fontSize: 9, letterSpacing: 1.5, color: colors?.textSecondary || '#8D7A64', marginBottom: 6, fontFamily: fonts?.sans }}>
        SPONSORED
      </Text>
      <NativeAdView nativeAd={nativeAd} style={{ width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!!nativeAd.icon && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={{ width: 44, height: 44, borderRadius: 10, marginRight: 12 }} />
            </NativeAsset>
          )}
          <View style={{ flex: 1 }}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: colors?.textPrimary || '#3E2723', fontFamily: fonts?.sansBold }}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {!!nativeAd.body && (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text numberOfLines={2} style={{ fontSize: 11, color: colors?.textSecondary || '#8D7A64', marginTop: 2, fontFamily: fonts?.sans }}>
                  {nativeAd.body}
                </Text>
              </NativeAsset>
            )}
          </View>
          {!!nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <View style={{ backgroundColor: colors?.gold || '#C9A86A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{nativeAd.callToAction}</Text>
              </View>
            </NativeAsset>
          )}
        </View>
        {/* NativeMediaView MUST be a descendant of NativeAdView — rendering it
            as a sibling outside NativeAdView is what caused
            "Cannot read property 'responseId' of undefined": the native
            module has no ad response to associate the media view with. */}
        {!!nativeAd.mediaContent && NativeMediaView && (
          <NativeMediaView style={{ width: '100%', height: 140, borderRadius: 10, marginTop: 10 }} resizeMode="cover" />
        )}
      </NativeAdView>
    </Animated.View>
  );
}
