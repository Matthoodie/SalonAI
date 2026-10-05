/*
 * SalonAI realistic development demo dataset.
 *
 * Svi podaci u ovom fileu su sintetički i služe isključivo
 * za development/demo svrhe.
 */

export const demoServices = [
  {
    key: 'mens_cut',
    name: 'Muško šišanje',
    category: 'Šišanje',
    priceCents: 1800,
    durationMinutes: 20,
  },
  {
    key: 'beard',
    name: 'Uređivanje brade',
    category: 'Muška njega',
    priceCents: 1000,
    durationMinutes: 15,
  },
  {
    key: 'womens_cut_short',
    name: 'Žensko šišanje - kratka kosa',
    category: 'Šišanje',
    priceCents: 2500,
    durationMinutes: 30,
  },
  {
    key: 'womens_cut_long',
    name: 'Žensko šišanje - duga kosa',
    category: 'Šišanje',
    priceCents: 3200,
    durationMinutes: 45,
  },
  {
    key: 'blowdry_short',
    name: 'Feniranje - kratka kosa',
    category: 'Feniranje',
    priceCents: 1800,
    durationMinutes: 30,
  },
  {
    key: 'blowdry_long',
    name: 'Feniranje - duga kosa',
    category: 'Feniranje',
    priceCents: 2500,
    durationMinutes: 45,
  },
  {
    key: 'root_color',
    name: 'Bojanje izrasta',
    category: 'Bojanje',
    priceCents: 3800,
    durationMinutes: 60,
  },
  {
    key: 'full_color',
    name: 'Bojanje cijele kose',
    category: 'Bojanje',
    priceCents: 5500,
    durationMinutes: 90,
  },
  {
    key: 'highlights_short',
    name: 'Pramenovi - kratka kosa',
    category: 'Pramenovi',
    priceCents: 6000,
    durationMinutes: 120,
  },
  {
    key: 'highlights_long',
    name: 'Pramenovi - duga kosa',
    category: 'Pramenovi',
    priceCents: 8500,
    durationMinutes: 150,
  },
  {
    key: 'balayage',
    name: 'Balayage',
    category: 'Bojanje',
    priceCents: 9500,
    durationMinutes: 180,
  },
  {
    key: 'formal_style',
    name: 'Svečana frizura',
    category: 'Styling',
    priceCents: 4500,
    durationMinutes: 60,
  },
  {
    key: 'hair_treatment',
    name: 'Tretman njege kose',
    category: 'Njega',
    priceCents: 2200,
    durationMinutes: 30,
  },
]

export const demoEmployees = [
  {
    key: 'ana',
    name: 'Ana Kovač',

    serviceKeys: [
      'womens_cut_short',
      'womens_cut_long',
      'blowdry_short',
      'blowdry_long',
      'root_color',
      'full_color',
      'formal_style',
      'hair_treatment',
    ],

    workingHours: [
      {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        dayOfWeek: 3,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        dayOfWeek: 4,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        dayOfWeek: 5,
        startTime: '09:00',
        endTime: '17:00',
      },
    ],
  },

  {
    key: 'linda',
    name: 'Linda Jugovac',

    serviceKeys: [
      'womens_cut_short',
      'womens_cut_long',
      'blowdry_short',
      'blowdry_long',
      'root_color',
      'formal_style',
      'hair_treatment',
    ],

    workingHours: [
      {
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '18:00',
      },
      {
        dayOfWeek: 3,
        startTime: '10:00',
        endTime: '18:00',
      },
      {
        dayOfWeek: 4,
        startTime: '10:00',
        endTime: '18:00',
      },
      {
        dayOfWeek: 5,
        startTime: '10:00',
        endTime: '18:00',
      },
      {
        dayOfWeek: 6,
        startTime: '10:00',
        endTime: '18:00',
      },
    ],
  },

  {
    key: 'petra',
    name: 'Petra Radić',

    serviceKeys: [
      'blowdry_short',
      'blowdry_long',
      'root_color',
      'full_color',
      'highlights_short',
      'highlights_long',
      'balayage',
      'hair_treatment',
    ],

    workingHours: [
      {
        dayOfWeek: 3,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        dayOfWeek: 4,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        dayOfWeek: 5,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '17:00',
      },
    ],
  },

  {
    key: 'marko',
    name: 'Marko Jurić',

    serviceKeys: [
      'mens_cut',
      'beard',
    ],

    workingHours: [
      {
        dayOfWeek: 1,
        startTime: '11:00',
        endTime: '19:00',
      },
      {
        dayOfWeek: 2,
        startTime: '11:00',
        endTime: '19:00',
      },
      {
        dayOfWeek: 3,
        startTime: '11:00',
        endTime: '19:00',
      },
      {
        dayOfWeek: 4,
        startTime: '11:00',
        endTime: '19:00',
      },
      {
        dayOfWeek: 5,
        startTime: '11:00',
        endTime: '19:00',
      },
    ],
  },
]

export const demoClients = [
  {
    key: 'client_01',
    name: 'Ivana Marić',
    phoneCountryCode: '+385',
    phoneNumber: '991000001',
    phoneNormalized: '+385991000001',
  },
  {
    key: 'client_02',
    name: 'Nika Perić',
    phoneCountryCode: '+385',
    phoneNumber: '991000002',
    phoneNormalized: '+385991000002',
  },
  {
    key: 'client_03',
    name: 'Lucija Horvat',
    phoneCountryCode: '+385',
    phoneNumber: '991000003',
    phoneNormalized: '+385991000003',
  },
  {
    key: 'client_04',
    name: 'Marta Barišić',
    phoneCountryCode: '+385',
    phoneNumber: '991000004',
    phoneNormalized: '+385991000004',
  },
  {
    key: 'client_05',
    name: 'Ema Radić',
    phoneCountryCode: '+385',
    phoneNumber: '991000005',
    phoneNormalized: '+385991000005',
  },
  {
    key: 'client_06',
    name: 'Sara Vuković',
    phoneCountryCode: '+385',
    phoneNumber: '991000006',
    phoneNormalized: '+385991000006',
  },
  {
    key: 'client_07',
    name: 'Lana Jurić',
    phoneCountryCode: '+385',
    phoneNumber: '991000007',
    phoneNormalized: '+385991000007',
  },
  {
    key: 'client_08',
    name: 'Mia Babić',
    phoneCountryCode: '+385',
    phoneNumber: '991000008',
    phoneNormalized: '+385991000008',
  },
  {
    key: 'client_09',
    name: 'Lea Kovačević',
    phoneCountryCode: '+385',
    phoneNumber: '991000009',
    phoneNormalized: '+385991000009',
  },
  {
    key: 'client_10',
    name: 'Karla Šarić',
    phoneCountryCode: '+385',
    phoneNumber: '991000010',
    phoneNormalized: '+385991000010',
  },
  {
    key: 'client_11',
    name: 'Dora Matković',
    phoneCountryCode: '+385',
    phoneNumber: '991000011',
    phoneNormalized: '+385991000011',
  },
  {
    key: 'client_12',
    name: 'Iva Pavlović',
    phoneCountryCode: '+385',
    phoneNumber: '991000012',
    phoneNormalized: '+385991000012',
  },
  {
    key: 'client_13',
    name: 'Nina Blažević',
    phoneCountryCode: '+385',
    phoneNumber: '991000013',
    phoneNormalized: '+385991000013',
  },
  {
    key: 'client_14',
    name: 'Ana Perković',
    phoneCountryCode: '+385',
    phoneNumber: '991000014',
    phoneNormalized: '+385991000014',
  },
  {
    key: 'client_15',
    name: 'Luka Marić',
    phoneCountryCode: '+385',
    phoneNumber: '991000015',
    phoneNormalized: '+385991000015',
  },
  {
    key: 'client_16',
    name: 'Ivan Barić',
    phoneCountryCode: '+385',
    phoneNumber: '991000016',
    phoneNormalized: '+385991000016',
  },
  {
    key: 'client_17',
    name: 'Marko Rukavina',
    phoneCountryCode: '+385',
    phoneNumber: '991000017',
    phoneNormalized: '+385991000017',
  },
  {
    key: 'client_18',
    name: 'Filip Kralj',
    phoneCountryCode: '+385',
    phoneNumber: '991000018',
    phoneNormalized: '+385991000018',
  },
  {
    key: 'client_19',
    name: 'Toni Perić',
    phoneCountryCode: '+385',
    phoneNumber: '991000019',
    phoneNormalized: '+385991000019',
  },
  {
    key: 'client_20',
    name: 'Marija Novak',
    phoneCountryCode: '+385',
    phoneNumber: '991000020',
    phoneNormalized: '+385991000020',
  },
]

export const demoDateOverrides = [
  {
    employeeKey: 'linda',
    date: '2026-10-09',
    enabled: true,
    startTime: '12:00',
    endTime: '20:00',
  },
]

export const demoTimeOff = [
  {
    employeeKey: 'petra',
    startDate: '2026-10-10',
    endDate: '2026-10-10',
    type: 'personal',
    note: 'Slobodan dan',
  },
]

export const demoBlockedTimes = [
  {
    employeeKey: 'ana',
    startsAt:
      '2026-10-06T12:30:00+02:00',
    endsAt:
      '2026-10-06T13:00:00+02:00',
    reason: 'Pauza',
  },
  {
    employeeKey: 'marko',
    startsAt:
      '2026-10-07T15:00:00+02:00',
    endsAt:
      '2026-10-07T16:00:00+02:00',
    reason: 'Privatna obveza',
  },
]

export const demoAppointments = [
  // --------------------------------------------------
  // 29.09.2026. - Tuesday
  // --------------------------------------------------

  {
    clientKey: 'client_01',
    employeeKey: 'ana',
    serviceKey: 'womens_cut_short',
    startsAt: '2026-09-29T09:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: 'Redovni termin',
  },
  {
    clientKey: 'client_02',
    employeeKey: 'ana',
    serviceKey: 'blowdry_long',
    startsAt: '2026-09-29T10:00:00+02:00',
    status: 'completed',
    source: 'web',
    notes: 'Feniranje prije poslovnog događaja',
  },
  {
    clientKey: 'client_03',
    employeeKey: 'linda',
    serviceKey: 'root_color',
    startsAt: '2026-09-29T10:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_15',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-09-29T11:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_16',
    employeeKey: 'marko',
    serviceKey: 'beard',
    startsAt: '2026-09-29T12:00:00+02:00',
    status: 'completed',
    source: 'web',
    notes: null,
  },
  {
    clientKey: 'client_04',
    employeeKey: 'linda',
    serviceKey: 'womens_cut_long',
    startsAt: '2026-09-29T13:30:00+02:00',
    status: 'cancelled',
    source: 'manual',
    notes: 'Klijentica otkazala termin',
  },

  // --------------------------------------------------
  // 30.09.2026. - Wednesday
  // --------------------------------------------------

  {
    clientKey: 'client_05',
    employeeKey: 'ana',
    serviceKey: 'full_color',
    startsAt: '2026-09-30T09:30:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_06',
    employeeKey: 'petra',
    serviceKey: 'highlights_short',
    startsAt: '2026-09-30T09:00:00+02:00',
    status: 'completed',
    source: 'web',
    notes: null,
  },
  {
    clientKey: 'client_07',
    employeeKey: 'linda',
    serviceKey: 'hair_treatment',
    startsAt: '2026-09-30T12:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: 'Njega suhe kose',
  },
  {
    clientKey: 'client_17',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-09-30T11:30:00+02:00',
    status: 'no_show',
    source: 'manual',
    notes: 'Klijent nije došao',
  },
  {
    clientKey: 'client_18',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-09-30T16:00:00+02:00',
    status: 'completed',
    source: 'web',
    notes: null,
  },

  // --------------------------------------------------
  // 01.10.2026. - Thursday
  // --------------------------------------------------

  {
    clientKey: 'client_08',
    employeeKey: 'ana',
    serviceKey: 'womens_cut_long',
    startsAt: '2026-10-01T10:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_09',
    employeeKey: 'linda',
    serviceKey: 'blowdry_short',
    startsAt: '2026-10-01T10:30:00+02:00',
    status: 'completed',
    source: 'web',
    notes: null,
  },
  {
    clientKey: 'client_10',
    employeeKey: 'petra',
    serviceKey: 'balayage',
    startsAt: '2026-10-01T11:30:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: 'Balayage i završni styling',
  },
  {
    clientKey: 'client_19',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-10-01T13:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_11',
    employeeKey: 'ana',
    serviceKey: 'root_color',
    startsAt: '2026-10-01T14:00:00+02:00',
    status: 'completed',
    source: 'web',
    notes: null,
  },
  {
    clientKey: 'client_12',
    employeeKey: 'linda',
    serviceKey: 'formal_style',
    startsAt: '2026-10-01T15:00:00+02:00',
    status: 'cancelled',
    source: 'manual',
    notes: 'Otkazano isti dan',
  },

  // --------------------------------------------------
  // 02.10.2026. - Friday
  // --------------------------------------------------

  {
    clientKey: 'client_13',
    employeeKey: 'ana',
    serviceKey: 'hair_treatment',
    startsAt: '2026-10-02T09:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_14',
    employeeKey: 'petra',
    serviceKey: 'full_color',
    startsAt: '2026-10-02T09:30:00+02:00',
    status: 'completed',
    source: 'web',
    notes: null,
  },
  {
    clientKey: 'client_01',
    employeeKey: 'linda',
    serviceKey: 'womens_cut_short',
    startsAt: '2026-10-02T11:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: 'Povratna klijentica',
  },
  {
    clientKey: 'client_20',
    employeeKey: 'marko',
    serviceKey: 'beard',
    startsAt: '2026-10-02T11:00:00+02:00',
    status: 'completed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_02',
    employeeKey: 'ana',
    serviceKey: 'blowdry_long',
    startsAt: '2026-10-02T13:00:00+02:00',
    status: 'no_show',
    source: 'web',
    notes: 'Klijentica nije došla',
  },
  {
    clientKey: 'client_15',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-10-02T17:30:00+02:00',
    status: 'cancelled',
    source: 'manual',
    notes: 'Termin otkazan',
  },

  // --------------------------------------------------
  // UPCOMING - 05.10.2026.
  // --------------------------------------------------

  {
    clientKey: 'client_03',
    employeeKey: 'ana',
    serviceKey: 'womens_cut_short',
    startsAt: '2026-10-05T09:00:00+02:00',
    status: 'confirmed',
    source: 'web',
    notes: null,
  },
  {
    clientKey: 'client_16',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-10-05T11:00:00+02:00',
    status: 'confirmed',
    source: 'manual',
    notes: null,
  },

  // --------------------------------------------------
  // 06.10.2026.
  // Ana blocked 12:30-13:00
  // --------------------------------------------------

  {
    clientKey: 'client_05',
    employeeKey: 'ana',
    serviceKey: 'hair_treatment',
    startsAt: '2026-10-06T11:45:00+02:00',
    status: 'confirmed',
    source: 'web',
    notes: 'Termin završava prije pauze',
  },
  {
    clientKey: 'client_06',
    employeeKey: 'ana',
    serviceKey: 'blowdry_short',
    startsAt: '2026-10-06T13:00:00+02:00',
    status: 'pending',
    source: 'manual',
    notes: 'Termin nakon pauze',
  },

  // --------------------------------------------------
  // 07.10.2026.
  // Marko blocked 15:00-16:00
  // --------------------------------------------------

  {
    clientKey: 'client_18',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-10-07T14:30:00+02:00',
    status: 'confirmed',
    source: 'manual',
    notes: 'Termin prije privatne obveze',
  },
  {
    clientKey: 'client_19',
    employeeKey: 'marko',
    serviceKey: 'beard',
    startsAt: '2026-10-07T16:00:00+02:00',
    status: 'confirmed',
    source: 'web',
    notes: 'Termin nakon privatne obveze',
  },
  {
    clientKey: 'client_08',
    employeeKey: 'petra',
    serviceKey: 'highlights_short',
    startsAt: '2026-10-07T09:00:00+02:00',
    status: 'pending',
    source: 'web',
    notes: null,
  },

  // --------------------------------------------------
  // 09.10.2026.
  // Linda override: 12:00-20:00
  // --------------------------------------------------

  {
    clientKey: 'client_09',
    employeeKey: 'linda',
    serviceKey: 'formal_style',
    startsAt: '2026-10-09T18:00:00+02:00',
    status: 'confirmed',
    source: 'manual',
    notes: 'Termin omogućen posebnim radnim vremenom',
  },

  // --------------------------------------------------
  // 10.10.2026.
  // Petra je na time-offu - nema Petrinih termina
  // --------------------------------------------------

  {
    clientKey: 'client_10',
    employeeKey: 'linda',
    serviceKey: 'blowdry_long',
    startsAt: '2026-10-10T10:30:00+02:00',
    status: 'pending',
    source: 'web',
    notes: null,
  },

  // --------------------------------------------------
  // NEXT WEEK
  // --------------------------------------------------

  {
    clientKey: 'client_11',
    employeeKey: 'ana',
    serviceKey: 'root_color',
    startsAt: '2026-10-12T11:00:00+02:00',
    status: 'confirmed',
    source: 'manual',
    notes: null,
  },
  {
    clientKey: 'client_20',
    employeeKey: 'marko',
    serviceKey: 'mens_cut',
    startsAt: '2026-10-13T12:00:00+02:00',
    status: 'confirmed',
    source: 'web',
    notes: null,
  },
  {
    clientKey: 'client_12',
    employeeKey: 'petra',
    serviceKey: 'balayage',
    startsAt: '2026-10-14T10:00:00+02:00',
    status: 'confirmed',
    source: 'manual',
    notes: 'Balayage rezervacija',
  },
]