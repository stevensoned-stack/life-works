import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo, ZoeyAvatar } from '../components/Art';
import Icon from '../components/Icon';
import { Button, Card } from '../components/ui';
import { useStore } from '../data/store';
import { MODULES, moduleRoute, Route } from '../modules';
import { colors, radius, shadow } from '../theme';
import { unreadFrom } from '../chat/sync';
import { call } from '../recovery/contact';
import { cleanTime, daysLabel } from '../recovery/milestones';
import { isToday, timeLabel } from '../util';
import { partOfDay } from '../zoey/copy';

export default function HomeScreen({ go, openMenu }: { go: (r: Route) => void; openMenu: () => void }) {
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const { name, coordinator } = state.profile;
  const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
  const clean = state.sobrietyDate ? cleanTime(state.sobrietyDate) : null;
  const unread = unreadFrom(state.messages);
  const lastToday = [...state.checkins].reverse().find((c) => c.completedAt && isToday(c.completedAt));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Open menu" style={styles.menuBtn}>
          <Icon name="menu" size={28} color={colors.ink} />
        </Pressable>
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Logo />
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Card style={styles.greet}>
          <ZoeyAvatar size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.greetTitle}>
              Good {partOfDay()}, {name}
            </Text>
            <Text style={styles.greetSub}>
              {lastToday
                ? `You checked in at ${timeLabel(lastToday.completedAt!)}. Nice work.`
                : 'Zoey has your check-in ready'}
            </Text>
          </View>
          <Button label={lastToday ? 'Again' : 'Start'} small onPress={() => go({ name: 'askzoey' })} />
        </Card>

        <View style={styles.cleanRow}>
          <Pressable
            style={({ pressed }) => [styles.clean, pressed && { opacity: 0.8 }]}
            onPress={() => go({ name: 'milestones' })}
            accessibilityRole="button"
            accessibilityLabel={clean ? `${daysLabel(clean.days)} clean. Open clean time` : 'Set up clean time'}
          >
            <Icon name="star" size={22} color={colors.green} />
            <View style={{ flex: 1 }}>
              {clean ? (
                <>
                  <Text style={styles.cleanDays}>{daysLabel(clean.days)}</Text>
                  <Text style={styles.cleanSub}>
                    {clean.hitToday
                      ? `You reached ${clean.hitToday.label} today!`
                      : clean.next
                        ? `${daysLabel(clean.daysToNext)} to ${clean.next.label}`
                        : 'Keep going'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.cleanDays}>Clean time</Text>
                  <Text style={styles.cleanSub}>Start counting your days</Text>
                </>
              )}
            </View>
          </Pressable>
          {sponsor ? (
            <Pressable
              style={({ pressed }) => [styles.sponsor, pressed && { opacity: 0.8 }]}
              onPress={() => call(sponsor.phone)}
              accessibilityRole="button"
              accessibilityLabel={`Call your sponsor, ${sponsor.name}`}
            >
              <Icon name="phone" size={18} />
              <Text style={styles.sponsorText} numberOfLines={1}>
                {sponsor.name.split(' ')[0]}
              </Text>
              <Text style={styles.sponsorSub}>Sponsor</Text>
            </Pressable>
          ) : null}
        </View>

        <Card style={styles.grid}>
          {MODULES.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => go(moduleRoute(m.id))}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}. ${m.subtitle}${m.ready ? '' : '. Coming soon'}${m.id === 'chat' && unread ? `. ${unread} new` : ''}`}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.6 }]}
            >
              {m.icon === 'zoey' ? (
                <ZoeyAvatar size={56} />
              ) : (
                <View style={[styles.tileIcon, { backgroundColor: m.color }]}>
                  <Icon name={m.icon} size={26} />
                </View>
              )}
              <Text style={styles.tileLabel}>{m.title}</Text>
              {!m.ready ? <Text style={styles.soon}>Soon</Text> : null}
              {m.id === 'chat' && unread ? <Text style={styles.unread}>{unread}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <Pressable
          onPress={() => Linking.openURL(`tel:${coordinator.phone}`).catch(() => {})}
          accessibilityRole="button"
          style={({ pressed }) => [styles.touch, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.touchIcon}>
            <Icon name="phone" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.touchTitle}>LifeTouch</Text>
            <Text style={styles.touchSub}>Reach {coordinator.name}, your coordinator, right now</Text>
          </View>
        </Pressable>

        <Text style={styles.footer}>
          A program by <Text style={{ fontWeight: '700', color: colors.green }}>Edge Consulting</Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: '#fff', borderBottomWidth: 4, borderBottomColor: colors.green },
  menuBtn: { position: 'absolute', left: 16, top: 0, zIndex: 2, padding: 4, marginTop: 14 },
  body: { padding: 16, gap: 14 },
  greet: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  greetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  greetSub: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  cleanRow: { flexDirection: 'row', gap: 10 },
  clean: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14, ...shadow },
  cleanDays: { fontSize: 18, fontWeight: '800', color: colors.green, fontVariant: ['tabular-nums'] },
  cleanSub: { fontSize: 13, color: colors.inkSoft },
  sponsor: { width: 88, backgroundColor: colors.green, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 1, ...shadow },
  sponsorText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sponsorSub: { color: colors.greenLight, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, paddingHorizontal: 4 },
  tile: { width: '33.33%', alignItems: 'center', paddingVertical: 12, gap: 6 },
  tileIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 14, color: colors.ink, fontWeight: '500' },
  soon: {
    position: 'absolute',
    top: 6,
    right: 12,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSoft,
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  unread: {
    position: 'absolute',
    top: 6,
    right: 22,
    minWidth: 22,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: colors.red,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  touch: {
    backgroundColor: colors.red,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    ...shadow,
  },
  touchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  touchSub: { color: '#FCE9E7', fontSize: 14, marginTop: 2 },
  footer: { textAlign: 'center', color: colors.inkSoft, fontSize: 13, marginTop: 10 },
});
