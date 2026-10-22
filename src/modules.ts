import { IconName } from './components/Icon';
import { ResourceCategory } from './data/resources';
import { colors } from './theme';

export type Route =
  | { name: 'home' }
  | { name: 'askzoey' }
  | { name: 'ask' }
  | { name: 'lifepath' }
  | { name: 'settings' }
  | { name: 'lifecircle' }
  | { name: 'calendar'; tab?: 'schedule' | 'meetings' }
  | { name: 'milestones' }
  | { name: 'reminders' }
  | { name: 'safetyreview' }
  | { name: 'resources'; category?: ResourceCategory }
  | { name: 'soon'; module: ModuleId };

export type ModuleId =
  | 'askzoey'
  | 'lifepath'
  | 'lifeevent'
  | 'lifecircle'
  | 'calendar'
  | 'lifegoals'
  | 'myhome'
  | 'chat'
  | 'checkin';

export type Module = {
  id: ModuleId;
  title: string;
  subtitle: string;
  icon: IconName | 'zoey';
  color: string;
  ready: boolean;
  // Shown on the "coming soon" screen for modules not built yet.
  about: string;
};

// Same set and order as the demo's home grid. Modules with ready: false are
// planned for later steps (connection features, Q&A, and so on).
export const MODULES: Module[] = [
  {
    id: 'askzoey',
    title: 'AskZoey',
    subtitle: 'Check in, ask anything, 24/7',
    icon: 'zoey',
    color: colors.module.askzoey,
    ready: true,
    about: '',
  },
  {
    id: 'lifepath',
    title: 'LifePath',
    subtitle: 'Your mood over time',
    icon: 'trend',
    color: colors.module.lifepath,
    ready: true,
    about: '',
  },
  {
    id: 'lifeevent',
    title: 'LifeEvent',
    subtitle: 'Journal what happened',
    icon: 'pencil',
    color: colors.module.lifeevent,
    ready: false,
    about: 'Log the things that happen, like a new job, a court date or thirty days clean, and see them next to your mood on LifePath.',
  },
  {
    id: 'lifecircle',
    title: 'LifeCircle',
    subtitle: 'Your team & chosen family',
    icon: 'people',
    color: colors.module.lifecircle,
    ready: true,
    about: 'Your care team and the people you choose, with one tap to call or text, and you decide what each person can see.',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    subtitle: 'Appointments, meetings, reminders',
    icon: 'calendar',
    color: colors.module.calendar,
    ready: true,
    about: 'Appointments, groups, work shifts and court dates in one place, with reminders.',
  },
  {
    id: 'lifegoals',
    title: 'LifeGoals',
    subtitle: 'Work, school & next steps',
    icon: 'target',
    color: colors.module.lifegoals,
    ready: false,
    about: 'Goals you set alone or with your counselor, broken into small steps you can check off each week.',
  },
  {
    id: 'myhome',
    title: 'MyHome',
    subtitle: 'Housing, lease & house rules',
    icon: 'home',
    color: colors.module.myhome,
    ready: false,
    about: 'Your housing plan, house rules, and local services that can help, checked and kept up to date.',
  },
  {
    id: 'chat',
    title: 'Chat',
    subtitle: 'Chat with your LifeCircle',
    icon: 'chat',
    color: colors.module.chat,
    ready: false,
    about: 'Private messages with the people in your LifeCircle and your care team.',
  },
  {
    id: 'checkin',
    title: 'Check In/Out',
    subtitle: 'Arrive and leave, shared',
    icon: 'checkin',
    color: colors.module.checkin,
    ready: false,
    about: 'Check in when you arrive at work, school, group or home, so your team knows you showed up.',
  },
];

const READY: Partial<Record<ModuleId, Route>> = {
  askzoey: { name: 'ask' },
  lifepath: { name: 'lifepath' },
  lifecircle: { name: 'lifecircle' },
  calendar: { name: 'calendar' },
};

export const moduleRoute = (id: ModuleId): Route => READY[id] ?? { name: 'soon', module: id };
