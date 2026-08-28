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
  // Dodaj salon_id.
  // Za sada je nullable jer u tablici već postoje podaci.
  pgm.addColumn('employee_services', {
    salon_id: {
      type: 'bigint',
    },
  })

  // Popuni salon_id prema zaposleniku.
  pgm.sql(`
    UPDATE employee_services es
    SET salon_id = e.salon_id
    FROM employees e
    WHERE es.employee_id = e.id;
  `)

  // Nakon backfilla salon_id mora uvijek postojati.
  pgm.alterColumn(
    'employee_services',
    'salon_id',
    {
      notNull: true,
    }
  )

  // Employee mora pripadati istom salonu.
  pgm.sql(`
    ALTER TABLE employee_services
    ADD CONSTRAINT employee_services_employee_same_salon_fkey
    FOREIGN KEY (employee_id, salon_id)
    REFERENCES employees (id, salon_id)
    ON DELETE CASCADE;
  `)

  // Service također mora pripadati istom salonu.
  pgm.sql(`
    ALTER TABLE employee_services
    ADD CONSTRAINT employee_services_service_same_salon_fkey
    FOREIGN KEY (service_id, salon_id)
    REFERENCES services (id, salon_id)
    ON DELETE CASCADE;
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropConstraint(
    'employee_services',
    'employee_services_service_same_salon_fkey'
  )

  pgm.dropConstraint(
    'employee_services',
    'employee_services_employee_same_salon_fkey'
  )

  pgm.dropColumn(
    'employee_services',
    'salon_id'
  )
}