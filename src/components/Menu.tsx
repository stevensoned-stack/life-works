import React, { useEffect, useRef } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { MODULES, moduleRoute, Route } from '../modules';
import { colors, radius } from '../theme';
import { Logo, ZoeyAvatar } from './Art';
import Icon from './Icon';

// Order matches the demo's side menu.
const ORDER = ['askzoey', 'lifepath', 'lifeevent', 'lifegoals', 'myhome', 'lifecircle', 'chat', 'calendar', 'checkin'];

export default function Menu({ open, onClose, go }: { open: boolean; onClose: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = Math.min(320, width * 0.82);
  const x = useRef(new Animated.Value(0)).current;
  const { state } = useStore();

  useEffect(() => {
    Animated.timing(x, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [open, x]);

  const nav = (r: Route) => {
    onClose();
    go(r);
  };

  const rows = ORDER.map((id) => MODULES.find((m) => m.id === id)!);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: x }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { width: panelW, paddingTop: insets.top + 12 },
          { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-panelW, 0] }) }] },
        ]}
        accessibilityViewIsModal
      >
        <View style={styles.head}>
          <Logo scale={0.85} />
          <Text style={styles.who}>
            {state.profile.name} · {state.profile.phase}
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: insets.bottom + 16 }}>
          <Pressable
            style={[styles.row, styles.touchRow]}
            onPress={() => Linking.openURL(`tel:${state.profile.coordinator.phone}`).catch(() => {})}
            accessibilityRole="button"
          >
            <View style={[styles.icon, { backgroundColor: colors.red }]}>
              <Icon name="hand" size={20} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.red }]}>LifeTouch</Text>
              <Text style={styles.sub}>One tap to your coordinator</Text>
            </View>
          </Pressable>
          {rows.map((m) => (
            <Pressable key={m.id} style={styles.row} onPress={() => nav(moduleRoute(m.id))} accessibilityRole="button">
              {m.icon === 'zoey' ? (
                <ZoeyAvatar size={38} />
              ) : (
                <View style={[styles.icon, { backgroundColor: m.color }]}>
                  <Icon name={m.icon} size={20} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{m.title}</Text>
                <Text style={styles.sub}>{m.ready ? m.subtitle : `${m.subtitle} · coming soon`}</Text>
              </View>
            </Pressable>
          ))}
          {[
            { title: 'In Recovery', sub: 'Your days and milestones', icon: 'star' as const, color: colors.module.lifepath, r: { name: 'milestones' } as Route },
            { title: 'Find a meeting', sub: 'AA, NA, SMART and more', icon: 'pin' as const, color: colors.module.calendar, r: { name: 'calendar', tab: 'meetings' } as Route },
            { title: 'Local help', sub: 'Shelter, housing, food, legal', icon: 'home' as const, color: colors.module.myhome, r: { name: 'resources' } as Route },
            { title: 'Reminders', sub: 'Check-ins and daily reminders', icon: 'bell' as const, color: colors.module.lifeevent, r: { name: 'reminders' } as Route },
          ].map((x) => (
            <Pressable key={x.title} style={styles.row} onPress={() => nav(x.r)} accessibilityRole="button">
              <View style={[styles.icon, { backgroundColor: x.color }]}>
                <Icon name={x.icon} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{x.title}</Text>
                <Text style={styles.sub}>{x.sub}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable style={styles.row} onPress={() => nav({ name: 'settings' })} accessibilityRole="button">
            <View style={[styles.icon, { backgroundColor: colors.module.settings }]}>
              <Icon name="gear" size={20} />
            </View>
            <View>
              <Text style={styles.title}>Settings</Text>
              <Text style={styles.sub}>Privacy, reminders, about</Text>
            </View>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(20,30,15,0.45)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#fff' },
  head: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 4, borderBottomColor: colors.green, alignItems: 'flex-start' },
  who: { color: colors.inkSoft, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 8, borderRadius: radius.sm },
  touchRow: { backgroundColor: colors.redLight },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft },
});
