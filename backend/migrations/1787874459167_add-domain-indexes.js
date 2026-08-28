/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createIndex(
    'appointments',
    ['salon_id', 'starts_at'],
    {
      name: 'appointments_salon_starts_at_idx',
    }
  )

  pgm.createIndex(
    'appointments',
    ['employee_id', 'starts_at'],
    {
      name: 'appointments_employee_starts_at_idx',
    }
  )

  pgm.createIndex(
    'clients',
    ['salon_id', 'phone_normalized'],
    {
      name: 'clients_salon_phone_normalized_idx',
    }
  )

  pgm.createIndex(
    'services',
    ['salon_id', 'active'],
    {
      name: 'services_salon_active_idx',
    }
  )

  pgm.createIndex(
    'employees',
    ['salon_id', 'active'],
    {
      name: 'employees_salon_active_idx',
    }
  )

  pgm.createIndex(
    'employee_time_off',
    ['employee_id', 'start_date', 'end_date'],
    {
      name: 'employee_time_off_employee_dates_idx',
    }
  )

  pgm.createIndex(
    'employee_blocked_times',
    ['employee_id', 'starts_at'],
    {
      name: 'employee_blocked_times_employee_starts_at_idx',
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropIndex(
    'employee_blocked_times',
    ['employee_id', 'starts_at'],
    {
      name: 'employee_blocked_times_employee_starts_at_idx',
    }
  )

  pgm.dropIndex(
    'employee_time_off',
    ['employee_id', 'start_date', 'end_date'],
    {
      name: 'employee_time_off_employee_dates_idx',
    }
  )

  pgm.dropIndex(
    'employees',
    ['salon_id', 'active'],
    {
      name: 'employees_salon_active_idx',
    }
  )

  pgm.dropIndex(
    'services',
    ['salon_id', 'active'],
    {
      name: 'services_salon_active_idx',
    }
  )

  pgm.dropIndex(
    'clients',
    ['salon_id', 'phone_normalized'],
    {
      name: 'clients_salon_phone_normalized_idx',
    }
  )

  pgm.dropIndex(
    'appointments',
    ['employee_id', 'starts_at'],
    {
      name: 'appointments_employee_starts_at_idx',
    }
  )

  pgm.dropIndex(
    'appointments',
    ['salon_id', 'starts_at'],
    {
      name: 'appointments_salon_starts_at_idx',
    }
  )
}