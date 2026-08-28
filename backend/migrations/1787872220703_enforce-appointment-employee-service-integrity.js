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
    'employee_services',
    'employee_services_employee_service_salon_unique',
    {
      unique: [
        'employee_id',
        'service_id',
        'salon_id',
      ],
    }
  )

  pgm.sql(`
    ALTER TABLE appointments
    ADD CONSTRAINT appointments_employee_service_qualified_fkey
    FOREIGN KEY (employee_id, service_id, salon_id)
    REFERENCES employee_services (employee_id, service_id, salon_id)
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
    'appointments_employee_service_qualified_fkey'
  )

  pgm.dropConstraint(
    'employee_services',
    'employee_services_employee_service_salon_unique'
  )
}