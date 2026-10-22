import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { MoodValue } from '../data/types';

// Zoey's avatar: an illustrated face rather than a photo, so she never reads as
// a real staff member (several state laws bar AI presenting as a professional).
export function ZoeyAvatar({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel="Zoey">
      <Circle cx="20" cy="20" r="20" fill="#CFE3F7" />
      <Path d="M8 40c1-8 6-12 12-12s11 4 12 12z" fill="#2479C9" />
      <Path d="M9.5 21c-1-9 4-14 10.5-14S31.5 12 30.5 21c-1 3-2 5-3 6l-15 0c-1-1-2-3-3-6z" fill="#3B2A20" />
      <Ellipse cx="20" cy="19" rx="7.2" ry="8.2" fill="#E8B48F" />
      <Path d="M12.5 15c2-5 9-7 15-2-3 0-8-1-11 3z" fill="#3B2A20" />
      <Circle cx="17.2" cy="19" r="1" fill="#2B1D16" />
      <Circle cx="22.8" cy="19" r="1" fill="#2B1D16" />
      <Path d="M17.4 23c1.5 1.4 3.7 1.4 5.2 0" stroke="#9C4B3A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function Logo({ scale = 1 }: { scale?: number }) {
  return (
    <View style={[styles.logo, { transform: [{ scale }] }]} accessibilityLabel="Recovery Works">
      <Svg width={88} height={64} viewBox="0 0 88 64">
        <Defs>
          <LinearGradient id="g1" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#7DBB3A" />
            <Stop offset="1" stopColor="#2F6B12" />
          </LinearGradient>
          <LinearGradient id="g2" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#A9D46A" />
            <Stop offset="1" stopColor="#4C8F22" />
          </LinearGradient>
        </Defs>
        <Path d="M4 40 C 30 38, 58 30, 82 2 C 66 30, 40 46, 6 48 Z" fill="url(#g1)" />
        <Path d="M4 50 C 28 50, 48 44, 66 30 C 52 46, 32 56, 6 57 Z" fill="url(#g2)" />
        <Path d="M6 60 C 24 61, 36 57, 48 50 C 38 59, 26 63, 8 63 Z" fill="#B9DC86" />
      </Svg>
      <View>
        <Text style={styles.logoTop}>Recovery</Text>
        <Text style={styles.logoBottom}>Works</Text>
        <Text style={styles.logoTag}>TREATMENT · HOUSING · WORK</Text>
      </View>
    </View>
  );
}

export const MOOD_LABELS: Record<MoodValue, string> = {
  [-2]: 'Very Sad',
  [-1]: 'Sad',
  0: 'Neutral',
  1: 'Happy',
  2: 'Very Happy',
};

export function MoodFace({ value, size = 34 }: { value: MoodValue; size?: number }) {
  // Mouth curve: negative values frown, positive smile.
  const mouth = {
    [-2]: 'M12 27 Q20 19 28 27',
    [-1]: 'M13 26 Q20 21.5 27 26',
    0: 'M13 24.5 L27 24.5',
    1: 'M13 23 Q20 28.5 27 23',
    2: 'M12 22 Q20 31 28 22',
  }[value];
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="18" fill={colors.amber} />
      {value <= -1 ? (
        <>
          <Path d="M11 13.5 L16 15" stroke="#5A3B05" strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M29 13.5 L24 15" stroke="#5A3B05" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : null}
      <Circle cx="14.5" cy="17.5" r="2" fill="#5A3B05" />
      <Circle cx="25.5" cy="17.5" r="2" fill="#5A3B05" />
      <Path d={mouth} stroke="#5A3B05" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoTop: { fontSize: 25, color: '#1F2A1A', fontWeight: '500', lineHeight: 27 },
  logoBottom: { fontSize: 25, color: colors.greenLine, fontWeight: '500', lineHeight: 27 },
  logoTag: { fontSize: 7.5, letterSpacing: 1, color: colors.inkFaint, marginTop: 4 },
});
