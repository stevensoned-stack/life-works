import { State } from '../data/types';
import { cleanTime } from '../recovery/milestones';
import { clock, fromYmd, ymd } from '../util';
import { AnswerContext } from './answers';

// The few facts about the person that answers may mention, read from their own data.
export function buildContext(state: State): AnswerContext {
  const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
  const t = state.sobrietyDate ? cleanTime(state.sobrietyDate) : null;
  const now = new Date();
  const next = state.calendar
    .map((e) => {
      const at = fromYmd(e.date);
      const [h, m] = e.time.split(':').map(Number);
      at.setHours(h, m, 0, 0);
      return { e, at };
    })
    .filter((x) => x.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  const when = (d: Date, time: string) =>
    ymd(d) === ymd(now)
      ? `today at ${clock(time)}`
      : `${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${clock(time)}`;
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  return {
    // What they asked Zoey to call them ("call me J"), while learning is on.
    name: (state.settings.zoeyLearns && state.learned?.nickname) || state.profile.name,
    coordinatorName: state.profile.coordinator.name,
    sponsorName: sponsor ? sponsor.name.split(' ')[0] : null,
    cleanDays: t ? t.days : null,
    cleanDate: state.sobrietyDate
      ? fromYmd(state.sobrietyDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null,
    nextMilestone: t?.next?.label ?? null,
    daysToNext: t?.next ? t.daysToNext : null,
    nextEvent: next ? { title: next.e.title, when: when(next.at, next.e.time) } : null,
    meetingsThisWeek: state.visits.filter((v) => fromYmd(v.date) >= new Date(weekAgo.toDateString())).length,
  };
}
