export const employees = [
  {
    id: 1,
    name: 'Ana Kovač',
    active: true,
    serviceIds: [1, 2],

    workingHours: {
      monday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      tuesday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      wednesday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      thursday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      friday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      saturday: {
        enabled: false,
        startTime: '',
        endTime: '',
      },
      sunday: {
        enabled: false,
        startTime: '',
        endTime: '',
      },
    },
    dateOverrides: [],
  },

  {
    id: 2,
    name: 'Marko Horvat',
    active: true,
    serviceIds: [1],

    workingHours: {
      monday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      tuesday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      wednesday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      thursday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      friday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      saturday: {
        enabled: false,
        startTime: '',
        endTime: '',
      },
      sunday: {
        enabled: false,
        startTime: '',
        endTime: '',
      },
    },

    dateOverrides: [],
  },

  {
    id: 3,
    name: 'Petra Marić',
    active: true,
    serviceIds: [2, 3],

    workingHours: {
      monday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      tuesday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      wednesday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      thursday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      friday: {
        enabled: true,
        startTime: '08:00',
        endTime: '16:00',
      },
      saturday: {
        enabled: false,
        startTime: '',
        endTime: '',
      },
      sunday: {
        enabled: false,
        startTime: '',
        endTime: '',
      },
    },
    dateOverrides: [],
  },
]