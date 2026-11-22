import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';
import { MoodValue } from '../data/types';
import { EDGE_LOGO, RW_LOGO, ZOEY_PHOTO as ZOEY } from './brandImages';

// Zoey's photo, the Recovery Works logo and the Edge Consulting logo, as in Ed's original
// demo (Ed, 2026-11-22: "fix the images on the app to match the original"), from that video.
const EDGE_W = 360;
const EDGE_H = 126;

export function ZoeyAvatar({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={ZOEY}
      accessibilityLabel="Zoey"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#5FC0A8' }}
    />
  );
}

// 551 x 207 image: the swoosh, "Recovery Works" and TREATMENT · HOUSING · WORK.
export function Logo({ scale = 1 }: { scale?: number }) {
  const w = 200 * scale;
  return <Image source={RW_LOGO} accessibilityLabel="Recovery Works" resizeMode="contain" style={{ width: w, height: (w * 207) / 551 }} />;
}

// "A program by" the Edge Consulting logo, on Home.
export function EdgeLogo({ height = 26 }: { height?: number }) {
  return (
    <View style={styles.edge} accessibilityLabel="Edge Consulting">
      <Image source={EDGE_LOGO} resizeMode="contain" style={{ height, width: (height * EDGE_W) / EDGE_H }} />
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
  edge: { backgroundColor: '#D9F4DF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
});
