import { Meeting } from '../data/types';

// SAMPLE listings for the preview. They are not real meetings. A live version
// would read from a verified directory (build plan section 10: entries carry
// verification dates and expire), not from hard-coded data.
export const SAMPLE_MEETINGS: Meeting[] = [
  { id: 'm1', name: 'Morning Serenity', fellowship: 'AA', weekday: -1, time: '07:00', format: 'in_person', place: 'Downtown community center', notes: 'Open · Big Book study' },
  { id: 'm2', name: 'Just for Today', fellowship: 'NA', weekday: -1, time: '12:00', format: 'online', place: 'Online video meeting', notes: 'Open · Beginner friendly' },
  { id: 'm3', name: 'Young People in Recovery', fellowship: 'NA', weekday: 3, time: '18:30', format: 'in_person', place: 'Youth center, room 2', notes: 'Ages 18 to 30' },
  { id: 'm4', name: 'SMART Recovery', fellowship: 'SMART', weekday: 2, time: '17:30', format: 'online', place: 'Online video meeting', notes: 'Tools-based, no steps' },
  { id: 'm5', name: 'Step Study', fellowship: 'AA', weekday: 4, time: '19:00', format: 'in_person', place: 'Church hall on 3rd Ave', notes: 'Closed · Step 1 to 3' },
  { id: 'm6', name: 'Celebrate Recovery', fellowship: 'Celebrate Recovery', weekday: 5, time: '18:00', format: 'in_person', place: 'Northside church', notes: 'Dinner at 5:30' },
  { id: 'm7', name: 'Recovery Dharma', fellowship: 'Recovery Dharma', weekday: 0, time: '10:00', format: 'in_person', place: 'Library meeting room', notes: 'Meditation-based' },
  { id: 'm8', name: 'Saturday Night Live', fellowship: 'NA', weekday: 6, time: '20:00', format: 'in_person', place: 'Recovery clubhouse', notes: 'Open · Speaker' },
  { id: 'm9', name: 'Late Night Lifeline', fellowship: 'AA', weekday: -1, time: '21:00', format: 'online', place: 'Online video meeting', notes: 'Open · Discussion' },
  { id: 'm10', name: 'Women in Recovery', fellowship: 'AA', weekday: 1, time: '18:00', format: 'in_person', place: 'Community center, room B', notes: 'Women only' },
];

// weekday -1 means the meeting runs every day.
export const meetsOn = (m: Meeting, weekday: number) => m.weekday === -1 || m.weekday === weekday;

// Official finders for real, current meetings.
export const OFFICIAL_FINDERS = [
  { name: 'AA Meeting Guide', url: 'https://www.aa.org/find-aa' },
  { name: 'NA Meeting Search', url: 'https://www.na.org/meetingsearch/' },
];
