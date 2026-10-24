// Local help, by region. The build plan (sec. 04) calls for "versioned,
// geo-scoped local services with verification dates": every entry here was
// checked against the source named on it on the `checked` date. To launch in
// another region, add a Region below and point CURRENT_REGION at it. Never add
// a number that you have not seen on the organization's or a government site.
//
// Beds and hours change often, so the screen always says to call ahead.

export type ResourceCategory = 'Shelter tonight' | 'Housing help' | 'Eviction and legal help' | 'Food' | 'Crisis lines';

export type Resource = {
  id: string;
  name: string;
  category: ResourceCategory;
  about: string;
  phone?: string;
  textNumber?: string;
  url?: string;
  address?: string;
  hours?: string;
  source: string;
};

export type Region = {
  id: string;
  name: string;
  checked: string; // YYYY-MM-DD
  shelterFinder?: { label: string; url: string };
  // City center, for Zoey's weather mention. Never the person's own location.
  weatherAt?: { lat: number; lon: number };
  resources: Resource[];
};

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  'Shelter tonight',
  'Housing help',
  'Eviction and legal help',
  'Food',
  'Crisis lines',
];

// Sources, checked 2026-10-21:
const POCKET = 'City of Spokane resource pocket guide (May 22, 2026)';
const SHELTERME = 'ShelterMeSpokane.org (City of Spokane)';
const EVICTION = 'City of Spokane eviction prevention provider directory';
const CLEAR = 'Washington CLEAR hotline page (wcls.org)';

export const SPOKANE: Region = {
  id: 'spokane-wa',
  name: 'Spokane area',
  checked: '2026-10-21',
  shelterFinder: { label: 'Open beds tonight', url: 'https://sheltermespokane.org/' },
  weatherAt: { lat: 47.6588, lon: -117.426 },
  resources: [
    // Shelter tonight
    {
      id: 'shelterme',
      name: 'Shelter Me Spokane',
      category: 'Shelter tonight',
      about: 'Shelter beds open tonight across Spokane, updated by the shelters. Call the shelter to confirm.',
      url: 'https://sheltermespokane.org/',
      source: SHELTERME,
    },
    {
      id: 'house-of-charity',
      name: 'House of Charity / Navigation Center',
      category: 'Shelter tonight',
      about: 'Men and women 18+. Daytime Navigation Center at 527 S Cannon, open daily 8:30 AM to 5:30 PM.',
      phone: '5095074624',
      source: `${SHELTERME}; ${POCKET}`,
    },
    {
      id: 'ugm-men',
      name: 'Union Gospel Mission Men’s Shelter',
      category: 'Shelter tonight',
      about: 'Men 18+, open 24/7. Sobriety screening at intake.',
      phone: '5095358510',
      address: '1224 E Trent Ave',
      source: `${POCKET}; ${SHELTERME}`,
    },
    {
      id: 'ugm-women',
      name: 'Union Gospel Mission Crisis Shelter for Women and Children',
      category: 'Shelter tonight',
      about: 'Women and children, open 24/7. Sobriety screening at intake.',
      phone: '5095350486',
      address: '1515 E Illinois Ave',
      source: `${POCKET}; ${SHELTERME}`,
    },
    {
      id: 'family-promise',
      name: 'Family Promise of Spokane',
      category: 'Shelter tonight',
      about: 'Shelter for families with children.',
      phone: '5097475487',
      url: 'https://www.familypromiseofspokane.org/',
      source: `${SHELTERME}; ${EVICTION}`,
    },
    {
      id: 'ywca',
      name: 'YWCA Spokane',
      category: 'Shelter tonight',
      about: 'Safe shelter and a 24-hour helpline for anyone experiencing domestic violence.',
      phone: '5093262255',
      textNumber: '5092203725',
      url: 'https://ywcaspokane.org/',
      source: `${SHELTERME}; ${EVICTION}`,
    },

    // Housing help (coordinated entry: the front door to housing programs)
    {
      id: 'snap-singles',
      name: 'SNAP Housing for Singles',
      category: 'Housing help',
      about: 'The front door to housing help for single adults and couples without children.',
      phone: '5094567627',
      url: 'https://www.snapwa.org/housing-stability-for-singles/',
      address: '124 E Pacific',
      hours: 'Mon to Wed, 8:30 AM to 4:30 PM (closed 12 to 1)',
      source: `${POCKET}; ${EVICTION}`,
    },
    {
      id: 'cc-families',
      name: 'Catholic Charities Homeless Families',
      category: 'Housing help',
      about: 'The front door to housing help for families with children.',
      phone: '5093255005',
      url: 'https://www.cceasternwa.org/homeless-resources',
      address: '101 E Hartson',
      hours: 'Tue to Thu, 8 AM to 3 PM',
      source: `${POCKET}; ${EVICTION}`,
    },
    {
      id: 'voa-youth',
      name: 'Volunteers of America Youth and Young Adult Housing',
      category: 'Housing help',
      about: 'Housing help for ages 13 to 24, including young people leaving foster care.',
      phone: '5099900519',
      address: '3104 E Augusta',
      hours: 'Mon to Fri, 9 AM to 5 PM',
      source: POCKET,
    },
    {
      id: 'spokane-housing-authority',
      name: 'Spokane Housing Authority',
      category: 'Housing help',
      about: 'Public housing and housing vouchers.',
      phone: '5093282953',
      address: '25 W Nora Ave',
      source: POCKET,
    },
    {
      id: 'homeless-coalition',
      name: 'Spokane Homeless Coalition',
      category: 'Housing help',
      about: 'Local network of people and groups working on homelessness. Holds a public meeting the first Thursday of each month.',
      url: 'https://www.spokanehc.com',
      source: 'Spokane Public Radio and The Fig Tree listings (no current phone published)',
    },

    // Eviction and legal help
    {
      id: 'wa-eviction-line',
      name: 'Washington eviction defense line',
      category: 'Eviction and legal help',
      about: 'Free legal help if you have an eviction notice or court papers. Call as soon as you get a notice.',
      phone: '18556578387',
      source: CLEAR,
    },
    {
      id: 'housing-justice-project',
      name: 'Housing Justice Project (Spokane)',
      category: 'Eviction and legal help',
      about: 'Free lawyers for tenants facing eviction. Press option 3.',
      phone: '5098786488',
      url: 'https://www.kcba.org/?pg=HJP-Spokane',
      source: EVICTION,
    },
    {
      id: 'clear',
      name: 'CLEAR legal aid hotline',
      category: 'Eviction and legal help',
      about: 'Free civil legal help for people with low incomes.',
      phone: '18882011014',
      hours: 'Weekdays, 9:15 AM to 12:15 PM',
      source: CLEAR,
    },

    // Food
    {
      id: 'ugm-meals',
      name: 'Union Gospel Mission meals',
      category: 'Food',
      about: 'Free lunch at 12 PM and dinner at 6 PM, every day.',
      address: '1224 E Trent Ave',
      source: POCKET,
    },
    {
      id: 'salvation-army-food',
      name: 'Salvation Army Food Bank',
      category: 'Food',
      about: 'Free groceries.',
      phone: '5093256810',
      address: '204 E Indiana',
      hours: 'Mon to Fri, 10 AM to 3 PM',
      source: POCKET,
    },

    // Crisis lines
    {
      id: 'regional-crisis',
      name: 'Spokane Regional Crisis Line',
      category: 'Crisis lines',
      about: 'Mental health and substance use crisis help, 24 hours a day.',
      phone: '18772661818',
      source: POCKET,
    },
  ],
};

export const CURRENT_REGION = SPOKANE;

// Every local number, so the reply validator can allow them.
export const regionNumbers = (r: Region = CURRENT_REGION) =>
  r.resources.flatMap((x) => [x.phone, x.textNumber]).filter((n): n is string => !!n);
