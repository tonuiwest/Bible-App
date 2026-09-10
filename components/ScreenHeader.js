import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

/**
 * Single source of truth for header safe-area handling. Every screen using
 * this instead of hand-rolled `paddingTop: insets.top + N` headers gets
 * consistent, correct spacing under the notch/status bar automatically.
 */
export default function ScreenHeader({ title, onBack, right, subtitle }) {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        paddingTop: insets.top + 10,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: 34 }}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text numberOfLines={1} style={{ fontSize: 13, letterSpacing: 1.5, fontWeight: '700', color: colors.textPrimary, fontFamily: fonts.serifBold }}>
          {title}
        </Text>
        {!!subtitle && <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <View style={{ minWidth: 34, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
        {right}
      </View>
    </View>
  );
}
