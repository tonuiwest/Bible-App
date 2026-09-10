import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

/**
 * A small icon button that flips light/dark mode. The preference is saved
 * (see ThemeContext) so it persists and applies instantly everywhere.
 */
export default function ThemeToggle({ size = 18, style }) {
  const { colors, isDark, toggleTheme } = useTheme();
  return (
    <TouchableOpacity
      onPress={toggleTheme}
      hitSlop={8}
      style={[{
        width: size + 16,
        height: size + 16,
        borderRadius: (size + 16) / 2,
        backgroundColor: colors.background2,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
      }, style]}
    >
      <Ionicons name={isDark ? 'sunny' : 'moon'} size={size} color={colors.gold} />
    </TouchableOpacity>
  );
}
