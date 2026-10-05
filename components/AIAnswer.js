import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const ICONS = {
  book: 'book-outline', bulb: 'bulb-outline', map: 'map-outline', key: 'key-outline', library: 'library-outline',
  reader: 'reader-outline', link: 'link-outline', walk: 'walk-outline', heart: 'heart-outline', star: 'star-outline',
  list: 'list-outline', 'information-circle': 'information-circle-outline', person: 'person-outline', time: 'time-outline',
  bookmark: 'bookmark-outline', search: 'search-outline', 'checkmark-done': 'checkmark-done-outline', 'hand-left': 'hand-left-outline',
  call: 'call-outline', megaphone: 'megaphone-outline', ribbon: 'ribbon-outline', flag: 'flag-outline', chatbubbles: 'chatbubbles-outline',
};

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
          <Text style={{ color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontFamily: fonts.serifBold }}>{result.title}</Text>
          {!!result.lead && (
            <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 6, fontFamily: fonts.serifItalic }}>{result.lead}</Text>
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
                <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 13, letterSpacing: 0.4, fontFamily: fonts.sansBold }}>{s.heading}</Text>
              </View>
            )}
            {!!s.body && String(s.body).split('\n\n').map((para, pi) => (
              <Text key={pi} style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 23, marginTop: pi ? 8 : 0, fontFamily: fonts.serif }}>
                {para.startsWith('Illustration — ') || para.startsWith('Application: ')
                  ? (
                    <>
                      <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.gold }}>{para.startsWith('Application: ') ? 'Application: ' : `${para.slice(15).split(':')[0]}: `}</Text>
                      {para.startsWith('Application: ') ? para.slice(13) : para.slice(15).split(':').slice(1).join(':').trim()}
                    </>
                  ) : para}
              </Text>
            ))}
            {(s.bullets || []).map((b, bi) => (
              <View key={bi} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Text style={{ color: colors.gold, fontSize: 15, lineHeight: 22 }}>•</Text>
                <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14.5, lineHeight: 22, fontFamily: fonts.sans }}>{b}</Text>
              </View>
            ))}
            {(s.verses || []).map((v, vi) => (
              <TouchableOpacity
                key={`${v.ref}-${vi}`}
                activeOpacity={onOpenVerse ? 0.7 : 1}
                onPress={() => onOpenVerse && onOpenVerse(v)}
                style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(201,168,106,0.08)' : '#FBF5E9', borderLeftWidth: 3, borderLeftColor: colors.gold }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 23, fontFamily: fonts.serifItalic }}>“{v.text}”</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.sansBold }}>{v.ref} · KJV</Text>
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
                <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansMedium }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>
      ) : null}
      {!locked && shown > sections.length && footer ? footer : null}
    </View>
  );
}
