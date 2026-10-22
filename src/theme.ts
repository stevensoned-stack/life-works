export const colors = {
  green: '#3E6B17',
  greenDark: '#2F5410',
  greenLight: '#E8F0DF',
  greenLine: '#4C7F22',
  bg: '#F3F5F0',
  card: '#FFFFFF',
  ink: '#1F2A1A',
  inkSoft: '#5B6656',
  inkFaint: '#8C9688',
  border: '#E3E7DE',
  blue: '#1F6FC5',
  blueLight: '#E3EEFA',
  red: '#B3261E',
  redDark: '#8F1D17',
  redLight: '#FBE5E3',
  amber: '#F2B632',
  module: {
    askzoey: '#2479C9',
    lifepath: '#3F9142',
    lifeevent: '#EF8A1E',
    lifecircle: '#2479C9',
    calendar: '#6B7280',
    lifegoals: '#D9363E',
    myhome: '#0F7B6C',
    chat: '#8E44AD',
    checkin: '#2E5A1C',
    settings: '#1F2A1A',
  },
  track: {
    healing: '#3F9142',
    home: '#0F7B6C',
    future: '#D9363E',
    family: '#2479C9',
  },
};

export const radius = { sm: 8, md: 14, lg: 18, pill: 999 };

export const shadow = {
  shadowColor: '#1F2A1A',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

export const type = {
  h1: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.ink },
  title: { fontSize: 16, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    color: colors.inkSoft,
    textTransform: 'uppercase' as const,
  },
};
