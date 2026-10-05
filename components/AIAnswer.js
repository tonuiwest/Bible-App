import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const ICONS = {
  book: 'book-outline', bulb: 'bulb-outline', map: 'map-outline', key: 'key-outline', library: 'library-outline',
  reader: 'reader-outline', link: 'link-outline', walk: 'walk-outline', heart: 'heart-outline', star: 'star-outline',
  list: 'list-outline', 'information-circle': 'information-circle-outline', person: 'person-outline', time: 'time-outline',
  bookmark: 'bookmark-outline', search: 'search-outline', 'checkmark-done': 'checkmark-done-outline', 'hand-left': 'hand-left-outline',
  call: 'call-outline', megaphone: 'megaphone-outline', ribbon: 'ribbon-outline', flag: 'flag-outline', chatbubbles: 'chatbubbles-outline',
};


// ---------------------------------------------------------------------------
// Reader-chosen text size for AI answers & sermons (shared across screens).
// ---------------------------------------------------------------------------
const SCALE_KEY = 'ai_text_scale_v1';
export const TEXT_SIZES = [
  { id: 'S', label: 'Small', scale: 0.9 },
  { id: 'M', label: 'Medium', scale: 1.0 },
  { id: 'L', label: 'Large', scale: 1.15 },
  { id: 'XL', label: 'Extra large', scale: 1.3 },
  { id: 'XXL', label: 'Huge', scale: 1.5 },
];
let currentScale = 1.0;
let loaded = false;
const listeners = new Set();

export function useAiTextScale() {
  const [scale, setScaleState] = useState(currentScale);
  useEffect(() => {
    listeners.add(setScaleState);
    if (!loaded) {
      loaded = true;
      AsyncStorage.getItem(SCALE_KEY).then((v) => {
        const n = parseFloat(v);
        if (n) { currentScale = n; listeners.forEach((l) => l(n)); }
      }).catch(() => {});
    } else {
      setScaleState(currentScale);
    }
    return () => listeners.delete(setScaleState);
  }, []);
  const setScale = (n) => {
    currentScale = n;
    listeners.forEach((l) => l(n));
    AsyncStorage.setItem(SCALE_KEY, String(n)).catch(() => {});
  };
  return [scale, setScale];
}

/** "Aa" header button that opens a text-size picker with a live preview. */
export function TextSizeButton() {
  const { colors, fonts } = useTheme();
  const [scale, setScale] = useAiTextScale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={8}
        style={{ height: 30, paddingHorizontal: 9, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
        <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.serifBold }}>A</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: fonts.serifBold }}>a</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: colors.parchment, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1.6, fontFamily: fonts.sansBold }}>TEXT SIZE</Text>
            <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.card, borderLeftWidth: 3, borderLeftColor: colors.gold }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16.5 * scale, lineHeight: 25 * scale, fontFamily: fonts.serifSemi }}>
                “The LORD is my shepherd; I shall not want.”
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
              {TEXT_SIZES.map((t) => {
                const on = Math.abs(scale - t.scale) < 0.01;
                return (
                  <TouchableOpacity key={t.id} onPress={() => setScale(t.scale)}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.goldLight : colors.card }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 11 + t.scale * 5, fontFamily: fonts.serifBold }}>A</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 9.5, marginTop: 2, fontFamily: fonts.sansMedium }}>{t.id}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={{ marginTop: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: fonts.sansBold }}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function FadeIn({ delay = 0, children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** Renders a structured AI answer / sermon with a gentle section-by-section reveal. */
export default function AIAnswer({ result, onOpenVerse, onFollowUp, animate = true, hideTitle = false, locked = false, footer }) {
  const { colors, fonts, isDark } = useTheme();
  const [shown, setShown] = useState(animate ? 0 : 999);
  const [scale] = useAiTextScale();
  const fz = (n) => Math.round(n * scale * 10) / 10;
  const sections = result?.sections || [];

  useEffect(() => {
    if (!animate) { setShown(999); return; }
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i > sections.length + 1) clearInterval(t);
    }, 260);
    return () => clearInterval(t);
  }, [result]);

  if (!result) return null;

  const visible = locked ? sections.slice(0, 3) : sections;

  return (
    <View>
      {!hideTitle && (
        <FadeIn>
          <Text style={{ color: colors.textPrimary, fontSize: fz(21), lineHeight: fz(27), fontFamily: fonts.serifBold }}>{result.title}</Text>
          {!!result.lead && (
            <Text style={{ color: colors.textPrimary, opacity: 0.85, fontSize: fz(16), lineHeight: fz(24), marginTop: 6, fontFamily: fonts.serifSemi }}>{result.lead}</Text>
          )}
        </FadeIn>
      )}

      {visible.map((s, idx) => (idx < shown ? (
        <FadeIn key={`${s.heading}-${idx}`}>
          <View style={{ marginTop: 18 }}>
            {!!s.heading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={ICONS[s.icon] || 'ellipse-outline'} size={13} color={colors.gold} />
                </View>
                <Text style={{ flex: 1, color: colors.textPrimary, fontSize: fz(13.5), letterSpacing: 0.3, fontFamily: fonts.sansBold }}>{s.heading}</Text>
              </View>
            )}
            {!!s.body && String(s.body).split('\n\n').map((para, pi) => (
              <Text key={pi} style={{ color: colors.textPrimary, fontSize: fz(16.5), lineHeight: fz(25), marginTop: pi ? 8 : 0, fontFamily: fonts.serif }}>
                {para.startsWith('Illustration — ') || para.startsWith('Application: ')
                  ? (
                    <>
                      <Text style={{ fontFamily: fonts.sansBold, fontSize: fz(13.5), color: colors.gold }}>{para.startsWith('Application: ') ? 'Application: ' : `${para.slice(15).split(':')[0]}: `}</Text>
                      {para.startsWith('Application: ') ? para.slice(13) : para.slice(15).split(':').slice(1).join(':').trim()}
                    </>
                  ) : para}
              </Text>
            ))}
            {(s.bullets || []).map((b, bi) => (
              <View key={bi} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Text style={{ color: colors.gold, fontSize: fz(15), lineHeight: fz(23) }}>•</Text>
                <Text style={{ flex: 1, color: colors.textPrimary, fontSize: fz(14.5), lineHeight: fz(22.5), fontFamily: fonts.sans }}>{b}</Text>
              </View>
            ))}
            {(s.verses || []).map((v, vi) => (
              <TouchableOpacity
                key={`${v.ref}-${vi}`}
                activeOpacity={onOpenVerse ? 0.7 : 1}
                onPress={() => onOpenVerse && onOpenVerse(v)}
                style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(201,168,106,0.08)' : '#FBF5E9', borderLeftWidth: 3, borderLeftColor: colors.gold }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: fz(16.5), lineHeight: fz(25), fontFamily: fonts.serifSemi }}>“{v.text}”</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <Text style={{ color: colors.gold, fontSize: fz(12.5), fontFamily: fonts.sansBold }}>{v.ref} · KJV</Text>
                  {onOpenVerse ? <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.sansMedium }}>Read ›</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>
      ) : null))}

      {locked && shown > visible.length ? footer : null}

      {!locked && shown > sections.length && (result.followUps || []).length > 0 && onFollowUp ? (
        <FadeIn>
          <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5, marginTop: 20, marginBottom: 8, fontFamily: fonts.sansBold }}>ASK NEXT</Text>
          <View style={{ gap: 8 }}>
            {result.followUps.map((f) => (
              <TouchableOpacity key={f} onPress={() => onFollowUp(f)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                <Ionicons name="return-down-forward" size={14} color={colors.gold} />
                <Text style={{ flex: 1, color: colors.textPrimary, fontSize: fz(13.5), fontFamily: fonts.sansMedium }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>
      ) : null}
      {!locked && shown > sections.length && footer ? footer : null}
    </View>
  );
}
