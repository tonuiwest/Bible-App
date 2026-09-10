import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

export default function ParchmentBackground({ children, style }) {
  const { colors, isDark } = useTheme();
  
  if (isDark) {
    // Night - true black with subtle vignette
    return (
      <View style={[{flex:1, backgroundColor: colors.background}, style]}>
        <LinearGradient
          colors={['#0A0A0A', '#141210', '#0A0A0A']}
          start={{x:0.5, y:0}} end={{x:0.5, y:1}}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(201,168,106,0.03)'}]} />
        {children}
      </View>
    );
  }

  // Day - Ancient Parchment #F9F1E7 with texture overlay
  return (
    <View style={[{flex:1, backgroundColor: colors.background}, style]}>
      <LinearGradient
        colors={['#F9F1E7', '#FDF6E3', '#F5E9D4', '#F9F1E7']}
        start={{x:0, y:0}} end={{x:1, y:1}}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle papyrus grain - using semi-transparent overlay */}
      <View style={[StyleSheet.absoluteFill, {opacity:0.06, backgroundColor: '#3E2723'}]} />
      <View style={[StyleSheet.absoluteFill, {opacity:0.04}]}>
        <View style={{flex:1, backgroundColor: 'transparent', 
          // dotted texture effect via border
          borderWidth:0.5, borderColor: 'rgba(62,39,35,0.08)', borderStyle:'dotted'}} />
      </View>
      {children}
    </View>
  );
}
