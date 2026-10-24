import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Menu from './src/components/Menu';
import { StoreProvider, useStore } from './src/data/store';
import { Route } from './src/modules';
import { syncNotifications } from './src/recovery/notifications';
import AskScreen from './src/screens/AskScreen';
import AskZoeyScreen from './src/screens/AskZoeyScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CheckInOutScreen from './src/screens/CheckInOutScreen';
import LifeCircleScreen from './src/screens/LifeCircleScreen';
import MilestonesScreen from './src/screens/MilestonesScreen';
import MyHomeScreen from './src/screens/MyHomeScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import ResourcesScreen from './src/screens/ResourcesScreen';
import SafetyReviewScreen from './src/screens/SafetyReviewScreen';
import HomeScreen from './src/screens/HomeScreen';
import LifeEventScreen from './src/screens/LifeEventScreen';
import LifeGoalsScreen from './src/screens/LifeGoalsScreen';
import LifePathScreen from './src/screens/LifePathScreen';
import { ComingSoonScreen, OnboardingScreen, SettingsScreen } from './src/screens/OtherScreens';
import { colors } from './src/theme';

// A small stack navigator: enough for this step's handful of screens without
// pulling in a routing library. Swap for Expo Router as the app grows.
function Root() {
  const { state, ready } = useStore();
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [menuOpen, setMenuOpen] = useState(false);
  const route = stack[stack.length - 1];

  const go = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  // Reschedule local notifications when anything that feeds them changes.
  const { reminders, calendar, plan, places, settings } = state;
  useEffect(() => {
    if (!ready || !settings.onboarded) return;
    const t = setTimeout(() => syncNotifications(state), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reminders, calendar, plan, places, settings]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [menuOpen, stack.length, back]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!state.settings.onboarded) return <OnboardingScreen />;

  let screen: React.ReactNode;
  switch (route.name) {
    case 'home':
      screen = <HomeScreen go={go} openMenu={() => setMenuOpen(true)} />;
      break;
    case 'askzoey':
      // Keyed per visit so each check-in starts fresh.
      screen = <AskZoeyScreen key={stack.length} go={go} back={back} />;
      break;
    case 'ask':
      screen = <AskScreen go={go} back={back} />;
      break;
    case 'lifepath':
      screen = <LifePathScreen back={back} go={go} />;
      break;
    case 'lifeevent':
      screen = <LifeEventScreen key={stack.length} back={back} go={go} edit={route.edit} newGoal={route.newGoal} />;
      break;
    case 'lifegoals':
      screen = <LifeGoalsScreen back={back} go={go} />;
      break;
    case 'settings':
      screen = <SettingsScreen back={back} go={go} />;
      break;
    case 'lifecircle':
      screen = <LifeCircleScreen back={back} />;
      break;
    case 'calendar':
      screen = <CalendarScreen key={route.tab ?? 'schedule'} back={back} go={go} initialTab={route.tab} />;
      break;
    case 'milestones':
      screen = <MilestonesScreen back={back} />;
      break;
    case 'reminders':
      screen = <RemindersScreen back={back} />;
      break;
    case 'resources':
      screen = <ResourcesScreen key={route.category ?? 'all'} back={back} initialCategory={route.category} />;
      break;
    case 'checkinout':
      screen = <CheckInOutScreen back={back} go={go} />;
      break;
    case 'myhome':
      screen = <MyHomeScreen back={back} go={go} />;
      break;
    case 'safetyreview':
      screen = <SafetyReviewScreen back={back} />;
      break;
    case 'soon':
      screen = <ComingSoonScreen module={route.module} back={back} />;
      break;
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={route.name === 'home' ? 'dark' : 'light'} />
      {screen}
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} go={go} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
