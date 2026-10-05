import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

/** Animated green progress bar used across reading plans. */
export default function ProgressBar({ percent = 0, height = 8, style, trackColor }) {
  const { colors, isDark } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(100, percent || 0));

  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 600, useNativeDriver: false }).start();
  }, [clamped]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View
      style={[{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor || (isDark ? 'rgba(67,192,122,0.12)' : '#E4EFE7'),
        overflow: 'hidden',
      }, style]}
    >
      <Animated.View style={{ width, height: '100%', borderRadius: height / 2, overflow: 'hidden' }}>
        <LinearGradient
          colors={isDark ? ['#2FA463', '#5AD68E'] : ['#1F8A4C', '#3CC173']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
