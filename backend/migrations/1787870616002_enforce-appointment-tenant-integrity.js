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
  pgm.addConstraint(
    'clients',
    'clients_id_salon_id_unique',
    {
      unique: ['id', 'salon_id'],
    }
  )

  pgm.addConstraint(
    'employees',
    'employees_id_salon_id_unique',
    {
      unique: ['id', 'salon_id'],
    }
  )

  pgm.addConstraint(
    'services',
    'services_id_salon_id_unique',
    {
      unique: ['id', 'salon_id'],
    }
  )

  pgm.sql(`
    ALTER TABLE appointments
    ADD CONSTRAINT appointments_client_same_salon_fkey
    FOREIGN KEY (client_id, salon_id)
    REFERENCES clients (id, salon_id)
    ON DELETE RESTRICT;
  `)

  pgm.sql(`
    ALTER TABLE appointments
    ADD CONSTRAINT appointments_employee_same_salon_fkey
    FOREIGN KEY (employee_id, salon_id)
    REFERENCES employees (id, salon_id)
    ON DELETE RESTRICT;
  `)

  pgm.sql(`
    ALTER TABLE appointments
    ADD CONSTRAINT appointments_service_same_salon_fkey
    FOREIGN KEY (service_id, salon_id)
    REFERENCES services (id, salon_id)
    ON DELETE RESTRICT;
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropConstraint(
    'appointments',
    'appointments_service_same_salon_fkey'
  )

  pgm.dropConstraint(
    'appointments',
    'appointments_employee_same_salon_fkey'
  )

  pgm.dropConstraint(
    'appointments',
    'appointments_client_same_salon_fkey'
  )

  pgm.dropConstraint(
    'services',
    'services_id_salon_id_unique'
  )

  pgm.dropConstraint(
    'employees',
    'employees_id_salon_id_unique'
  )

  pgm.dropConstraint(
    'clients',
    'clients_id_salon_id_unique'
  )
}