// The agreements a person accepts before using Life Works, and which of them
// need to be asked for again.
//
// THE TEXT BELOW IS PLACEHOLDER, NOT LEGAL LANGUAGE. Each document lists what it
// needs to cover so an attorney can write the real text. Replace `body` (and the
// summary if it no longer fits), then raise `version`. Raising a version makes
// the app ask everyone to agree to that document again on their next open.

export type LegalDocId = 'terms' | 'privacy' | 'eula' | 'hipaa' | 'part2';

export type LegalDoc = {
  id: LegalDocId;
  title: string;
  // Bump whenever the text changes in a way people must agree to again.
  version: string;
  // False while the text is a placeholder; the app shows a draft banner.
  final: boolean;
  // What the person is agreeing to, on the checkbox.
  agreeLabel: string;
  // One or two plain sentences shown under the title.
  summary: string;
  body: { heading: string; text: string }[];
};

export type Agreement = { version: string; at: string };
export type Agreements = Partial<Record<LegalDocId, Agreement>>;

// Every section carries this until an attorney replaces it.
const section = (heading: string, covers: string) => ({ heading, text: `PLACEHOLDER, attorney to write. Must cover ${covers}` });

export const LEGAL_DOCS: LegalDoc[] = [
  {
    id: 'terms',
    title: 'Terms and Conditions',
    version: '0.1-draft',
    final: false,
    agreeLabel: 'I agree to the Terms and Conditions',
    summary:
      'The rules for using Life Works. Life Works and Zoey are support tools, not medical care or emergency services.',
    body: [
      section('Who we are', 'Edge Consulting as the provider of Life Works, contact details, and who the agreement is between.'),
      section(
        'Not medical or emergency care',
        'Life Works and Zoey (an automated assistant) do not diagnose, treat or give medical advice; in an emergency call 911, and for a crisis call or text 988.',
      ),
      section('Who can use Life Works', 'age requirements, program enrollment, and use on behalf of someone else.'),
      section('Your account and your phone', 'keeping the phone and app secure, and what happens if the phone is lost.'),
      section('Acceptable use', 'what people may not do in the app, including in Chat with their LifeCircle.'),
      section('Safety alerts and staff', 'that some messages can alert the care team, as set out in the Privacy Policy and Part 2 consent.'),
      section('Ending use', 'how a person stops using Life Works and what happens to their data.'),
      section('Limits of liability, disputes and governing law', 'liability limits, how disputes are settled, and Washington State law, as counsel advises.'),
      section('Changes to these terms', 'how people are told, and that the app asks them to agree again.'),
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    version: '0.1-draft',
    final: false,
    agreeLabel: 'I agree to the Privacy Policy',
    summary:
      'What Life Works keeps and shares. Check-ins, moods and notes are encrypted and stay on this phone; only safety alerts and things you choose to share leave it.',
    body: [
      section('What we collect', 'moods, check-ins, notes, questions, LifeCircle contacts, calendar, MyHome details, Check In/Out places, and location only at the moment of a tap.'),
      section('What stays on this phone', 'that this data is encrypted on the phone and left out of iCloud and Google backups.'),
      section('What leaves the phone', 'safety alerts the person agreed to, attendance they chose to share, Chat messages, and the server that sends staff texts.'),
      section('Who we share with', 'Life Works staff by role, service providers under a business associate agreement (such as hosting and text messaging), and when the law requires it.'),
      section('What we never do', 'sell data or use it for advertising.'),
      section('Your choices', 'turning sharing on or off in Settings, getting a copy, and deleting data.'),
      section('How long we keep it', 'retention for anything stored on the Life Works server.'),
      section('Security', 'encryption on the phone and on the server.'),
      section('Contact', 'who to contact with privacy questions or complaints.'),
    ],
  },
  {
    id: 'eula',
    title: 'End User License Agreement (EULA)',
    version: '0.1-draft',
    final: false,
    agreeLabel: 'I agree to the End User License Agreement',
    summary: 'The license to install and use the Life Works app on your phone.',
    body: [
      section('License', 'a personal, non-transferable license to use the app.'),
      section('Restrictions', 'copying, reverse engineering, and resale.'),
      section('App stores', 'the terms Apple and Google require in an app EULA.'),
      section('Updates', 'how updates are delivered and whether they are required.'),
      section('Ownership', 'that Edge Consulting keeps ownership of the app.'),
      section('Warranty disclaimer and termination', 'the warranty disclaimer and when the license ends.'),
    ],
  },
  {
    id: 'hipaa',
    title: 'HIPAA Notice of Privacy Practices',
    version: '0.1-draft',
    final: false,
    agreeLabel: 'I have received the HIPAA Notice of Privacy Practices',
    summary:
      'How your health information may be used and shared, and your rights under HIPAA. You are acknowledging that you received it.',
    body: [
      section(
        'Whether HIPAA applies',
        'whether Edge Consulting or the program running Life Works is a covered entity or business associate. Counsel should confirm this before the notice is used.',
      ),
      section('How we may use and share your health information', 'uses for treatment, payment and health care operations, with examples.'),
      section('Uses that need your written permission', 'which uses need written permission, and how to take permission back.'),
      section('Your rights', 'the right to see and get a copy, ask for corrections, ask for limits, get a list of disclosures, choose how we contact you, and get a paper copy.'),
      section('Our duties', 'the duty to protect the information, follow this notice, and tell you about a breach.'),
      section('Complaints', 'how to complain to us and to the U.S. Department of Health and Human Services, and that there is no retaliation.'),
      section('Effective date and changes', 'the date this notice takes effect.'),
    ],
  },
  {
    id: 'part2',
    title: 'Consent to Share Substance Use Records (42 CFR Part 2)',
    version: '0.1-draft',
    final: false,
    agreeLabel: 'I consent to the sharing described in the 42 CFR Part 2 consent',
    summary:
      'Federal law gives extra protection to records about substance use care. This consent says who Life Works may share them with, and why.',
    body: [
      section('Your name and who is sharing', 'the person, and the program or Life Works as the one sharing the records.'),
      section('Who receives the information', 'who receives it, by name or role, such as the coordinator, house manager, case manager and program director.'),
      section('What is shared', 'safety alerts and the words that triggered them, and attendance when the person turns sharing on.'),
      section('Why it is shared', 'the purpose: supporting the person\'s safety and recovery.'),
      section('How long the consent lasts', 'when the consent ends (a date or an event).'),
      section('Taking consent back', 'that the person can revoke consent at any time, in writing or in Settings, except for what was already shared.'),
      section('Required notices', 'the Part 2 notice against re-disclosure, and that treatment does not depend on signing, as required by the current rule.'),
      section('Signature and date', 'how the electronic agreement counts as a signature.'),
    ],
  },
];

export const legalDoc = (id: LegalDocId) => LEGAL_DOCS.find((d) => d.id === id)!;

// Documents the person hasn't agreed to yet, or agreed to an older version of.
export function pendingAgreements(accepted: Agreements | undefined, docs: LegalDoc[] = LEGAL_DOCS): LegalDoc[] {
  return docs.filter((d) => accepted?.[d.id]?.version !== d.version);
}

// True when the person has agreed before and only some versions changed.
export const isUpdate = (accepted: Agreements | undefined) => !!accepted && Object.keys(accepted).length > 0;

export function acceptAll(accepted: Agreements | undefined, docs: LegalDoc[], at = new Date()): Agreements {
  const next: Agreements = { ...accepted };
  for (const d of docs) next[d.id] = { version: d.version, at: at.toISOString() };
  return next;
}
