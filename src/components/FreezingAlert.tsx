// The below-freezing alert, for the check-in, AskZoey and Check In/Out (Ed, 2026-11-22:
// "add it under check in and askzoey"). The same question as the Home card, with taps
// instead of typing: Yes opens tonight's shelters, No hides it everywhere until the
// alert changes. Shows only when the forecast drops to 32° or colder.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '../data/store';
import { Route } from '../modules';
import { colors, radius } from '../theme';
import { seenAlerts, useWeatherAlert } from '../zoey/useWeatherAlert';
import Icon from './Icon';
import { Button } from './ui';

export default function FreezingAlert({ go }: { go: (r: Route) => void }) {
  const { state } = useStore();
  const wx = useWeatherAlert(state);
  const [, setSeen] = useState(0);
  if (!wx?.ask || seenAlerts.has(wx.key)) return null;
  return (
    <View style={styles.box} accessibilityRole="alert" accessibilityLabel={`${wx.title}. ${wx.tip} ${wx.ask}`}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name="cloud" size={18} color={colors.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{wx.title}</Text>
          <Text style={styles.place}>Forecast for {wx.place}</Text>
        </View>
      </View>
      <Text style={styles.tip}>{wx.tip}</Text>
      <Text style={styles.ask}>{wx.ask}</Text>
      <View style={styles.buttons}>
        <Button label="Yes, help me find one" small icon="home" onPress={() => go({ name: 'resources', category: 'Shelter tonight' })} />
        <Button
          label="No, I'm okay"
          small
          tone="outline"
          onPress={() => {
            seenAlerts.add(wx.key);
            setSeen((n) => n + 1);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.blueLight, borderRadius: radius.md, padding: 12, gap: 6, borderLeftWidth: 4, borderLeftColor: colors.blue },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink },
  place: { fontSize: 12, color: colors.inkSoft },
  tip: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  ask: { fontSize: 15, fontWeight: '700', color: colors.ink, lineHeight: 21 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
