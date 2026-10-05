import pool from './pool.js'

import {
  demoAppointments,
  demoBlockedTimes,
  demoClients,
  demoDateOverrides,
  demoEmployees,
  demoServices,
  demoTimeOff,
} from './demoSeedData.js'

const EXPECTED_DATABASE =
  'salonai_dev'

const EXPECTED_SALON_ID =
  1

const EXPECTED_SALON_NAME =
  'SalonAI Development Salon'

async function seedDemo() {
  const client =
    await pool.connect()

  try {
    await client.query('BEGIN')

    console.log(
      'Starting SalonAI realistic demo seed...'
    )

    const databaseResult =
      await client.query(
        `
          SELECT current_database() AS database
        `
      )

    const database =
      databaseResult.rows[0].database

    if (
      database !== EXPECTED_DATABASE
    ) {
      throw new Error(
        `SAFETY STOP: expected database ${EXPECTED_DATABASE}, got ${database}`
      )
    }

    const salonResult =
      await client.query(
        `
          SELECT
            id,
            name
          FROM salons
          WHERE id = $1
        `,
        [
          EXPECTED_SALON_ID,
        ]
      )

    const salon =
      salonResult.rows[0]

    if (
      !salon ||
      Number(salon.id) !==
        EXPECTED_SALON_ID ||
      salon.name !==
        EXPECTED_SALON_NAME
    ) {
      throw new Error(
        'SAFETY STOP: expected SalonAI Development Salon with id=1.'
      )
    }

    console.log(
      `Using salon: ${salon.name} (id=${salon.id})`
    )

    /*
     * Development demo seed je deterministički.
     *
     * Brišemo isključivo podatke salona 1.
     * Ostali saloni ostaju netaknuti.
     */

    const deletedAppointments =
      await client.query(
        `
          DELETE FROM appointments
          WHERE salon_id = $1
        `,
        [
          salon.id,
        ]
      )

    console.log(
      `Removed old appointments: ${deletedAppointments.rowCount}`
    )

    const deletedEmployees =
      await client.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
        `,
        [
          salon.id,
        ]
      )

    console.log(
      `Removed old employees: ${deletedEmployees.rowCount}`
    )

    const deletedServices =
      await client.query(
        `
          DELETE FROM services
          WHERE salon_id = $1
        `,
        [
          salon.id,
        ]
      )

    console.log(
      `Removed old services: ${deletedServices.rowCount}`
    )

    const deletedClients =
      await client.query(
        `
          DELETE FROM clients
          WHERE salon_id = $1
        `,
        [
          salon.id,
        ]
      )

    console.log(
      `Removed old clients: ${deletedClients.rowCount}`
    )

    /*
     * SERVICES
     */

    const serviceIds =
      new Map()

    for (
      const service
      of demoServices
    ) {
      const result =
        await client.query(
          `
            INSERT INTO services (
              salon_id,
              name,
              category,
              price_cents,
              default_duration_minutes,
              active
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              TRUE
            )
            RETURNING
              id,
              name
          `,
          [
            salon.id,
            service.name,
            service.category,
            service.priceCents,
            service.durationMinutes,
          ]
        )

      serviceIds.set(
        service.key,
        result.rows[0].id
      )
    }

    console.log(
      `Created services: ${serviceIds.size}`
    )

    /*
     * EMPLOYEES
     */

    const employeeIds =
      new Map()

    for (
      const employee
      of demoEmployees
    ) {
      const employeeResult =
        await client.query(
          `
            INSERT INTO employees (
              salon_id,
              name,
              active
            )
            VALUES (
              $1,
              $2,
              TRUE
            )
            RETURNING
              id,
              name
          `,
          [
            salon.id,
            employee.name,
          ]
        )

      const employeeId =
        employeeResult.rows[0].id

      employeeIds.set(
        employee.key,
        employeeId
      )

      /*
       * Employee ↔ services
       */

      for (
        const serviceKey
        of employee.serviceKeys
      ) {
        const serviceId =
          serviceIds.get(
            serviceKey
          )

        if (!serviceId) {
          throw new Error(
            `Unknown service key: ${serviceKey}`
          )
        }

        await client.query(
          `
            INSERT INTO employee_services (
              employee_id,
              service_id,
              salon_id
            )
            VALUES (
              $1,
              $2,
              $3
            )
          `,
          [
            employeeId,
            serviceId,
            salon.id,
          ]
        )
      }

      /*
       * Working hours
       */

      for (
        const workingHour
        of employee.workingHours
      ) {
        await client.query(
          `
            INSERT INTO employee_working_hours (
              employee_id,
              day_of_week,
              start_time,
              end_time
            )
            VALUES (
              $1,
              $2,
              $3,
              $4
            )
          `,
          [
            employeeId,
            workingHour.dayOfWeek,
            workingHour.startTime,
            workingHour.endTime,
          ]
        )
      }
    }

    console.log(
      `Created employees: ${employeeIds.size}`
    )

    /*
     * AVAILABILITY EXCEPTIONS
     */

    for (
      const override
      of demoDateOverrides
    ) {
      const employeeId =
        employeeIds.get(
          override.employeeKey
        )

      if (!employeeId) {
        throw new Error(
          `Unknown employee key for date override: ${override.employeeKey}`
        )
      }

      await client.query(
        `
          INSERT INTO employee_date_overrides (
            employee_id,
            date,
            enabled,
            start_time,
            end_time
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
        `,
        [
          employeeId,
          override.date,
          override.enabled,
          override.startTime,
          override.endTime,
        ]
      )
    }

    console.log(
      `Created date overrides: ${demoDateOverrides.length}`
    )

    for (
      const timeOff
      of demoTimeOff
    ) {
      const employeeId =
        employeeIds.get(
          timeOff.employeeKey
        )

      if (!employeeId) {
        throw new Error(
          `Unknown employee key for time off: ${timeOff.employeeKey}`
        )
      }

      await client.query(
        `
          INSERT INTO employee_time_off (
            employee_id,
            start_date,
            end_date,
            type,
            note
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
        `,
        [
          employeeId,
          timeOff.startDate,
          timeOff.endDate,
          timeOff.type,
          timeOff.note,
        ]
      )
    }

    console.log(
      `Created time-off rows: ${demoTimeOff.length}`
    )

    for (
      const blockedTime
      of demoBlockedTimes
    ) {
      const employeeId =
        employeeIds.get(
          blockedTime.employeeKey
        )

      if (!employeeId) {
        throw new Error(
          `Unknown employee key for blocked time: ${blockedTime.employeeKey}`
        )
      }

      await client.query(
        `
          INSERT INTO employee_blocked_times (
            employee_id,
            starts_at,
            ends_at,
            reason
          )
          VALUES (
            $1,
            $2,
            $3,
            $4
          )
        `,
        [
          employeeId,
          blockedTime.startsAt,
          blockedTime.endsAt,
          blockedTime.reason,
        ]
      )
    }

    console.log(
      `Created blocked times: ${demoBlockedTimes.length}`
    )

    /*
     * CLIENTS
     */

    const clientIds =
      new Map()

    for (
      const demoClient
      of demoClients
    ) {
      const result =
        await client.query(
          `
            INSERT INTO clients (
              salon_id,
              name,
              phone_country_code,
              phone_number,
              phone_normalized,
              active
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              TRUE
            )
            RETURNING
              id,
              name
          `,
          [
            salon.id,
            demoClient.name,
            demoClient.phoneCountryCode,
            demoClient.phoneNumber,
            demoClient.phoneNormalized,
          ]
        )

      clientIds.set(
        demoClient.key,
        result.rows[0].id
      )
    }

    console.log(
      `Created clients: ${clientIds.size}`
    )

    /*
     * APPOINTMENTS
     */

    for (
      const appointment
      of demoAppointments
    ) {
      const clientId =
        clientIds.get(
          appointment.clientKey
        )

      if (!clientId) {
        throw new Error(
          `Unknown client key for appointment: ${appointment.clientKey}`
        )
      }

      const employeeId =
        employeeIds.get(
          appointment.employeeKey
        )

      if (!employeeId) {
        throw new Error(
          `Unknown employee key for appointment: ${appointment.employeeKey}`
        )
      }

      const serviceId =
        serviceIds.get(
          appointment.serviceKey
        )

      if (!serviceId) {
        throw new Error(
          `Unknown service key for appointment: ${appointment.serviceKey}`
        )
      }

      const service =
        demoServices.find(
          (item) =>
            item.key ===
            appointment.serviceKey
        )

      if (!service) {
        throw new Error(
          `Missing service definition: ${appointment.serviceKey}`
        )
      }

      const startsAt =
        new Date(
          appointment.startsAt
        )

      if (
        Number.isNaN(
          startsAt.getTime()
        )
      ) {
        throw new Error(
          `Invalid appointment startsAt: ${appointment.startsAt}`
        )
      }

      const endsAt =
        new Date(
          startsAt.getTime() +
            service.durationMinutes *
              60 *
              1000
        )

      await client.query(
        `
          INSERT INTO appointments (
            salon_id,
            client_id,
            employee_id,
            service_id,
            starts_at,
            ends_at,
            price_cents,
            duration_minutes,
            status,
            source,
            notes
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11
          )
        `,
        [
          salon.id,
          clientId,
          employeeId,
          serviceId,
          startsAt.toISOString(),
          endsAt.toISOString(),
          service.priceCents,
          service.durationMinutes,
          appointment.status,
          appointment.source,
          appointment.notes,
        ]
      )
    }

    console.log(
      `Created appointments: ${demoAppointments.length}`
    )

    /*
     * FINAL VERIFICATION
     */

const countsResult =
  await client.query(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM clients
          WHERE salon_id = $1
        ) AS clients,

        (
          SELECT COUNT(*)
          FROM employees
          WHERE salon_id = $1
        ) AS employees,

        (
          SELECT COUNT(*)
          FROM services
          WHERE salon_id = $1
        ) AS services,

        (
          SELECT COUNT(*)
          FROM appointments
          WHERE salon_id = $1
        ) AS appointments,

        (
          SELECT COUNT(*)
          FROM employee_services
          WHERE salon_id = $1
        ) AS employee_services,

        (
          SELECT COUNT(*)
          FROM employee_working_hours ewh
          JOIN employees e
            ON e.id = ewh.employee_id
          WHERE e.salon_id = $1
        ) AS working_hours,

        (
          SELECT COUNT(*)
          FROM employee_date_overrides edo
          JOIN employees e
            ON e.id = edo.employee_id
          WHERE e.salon_id = $1
        ) AS date_overrides,

        (
          SELECT COUNT(*)
          FROM employee_time_off eto
          JOIN employees e
            ON e.id = eto.employee_id
          WHERE e.salon_id = $1
        ) AS time_off,

        (
          SELECT COUNT(*)
          FROM employee_blocked_times ebt
          JOIN employees e
            ON e.id = ebt.employee_id
          WHERE e.salon_id = $1
        ) AS blocked_times,

        (
          SELECT COUNT(*)
          FROM appointments
          WHERE salon_id = $1
            AND status = 'completed'
        ) AS completed,

        (
          SELECT COUNT(*)
          FROM appointments
          WHERE salon_id = $1
            AND status = 'confirmed'
        ) AS confirmed,

        (
          SELECT COUNT(*)
          FROM appointments
          WHERE salon_id = $1
            AND status = 'pending'
        ) AS pending,

        (
          SELECT COUNT(*)
          FROM appointments
          WHERE salon_id = $1
            AND status = 'cancelled'
        ) AS cancelled,

        (
          SELECT COUNT(*)
          FROM appointments
          WHERE salon_id = $1
            AND status = 'no_show'
        ) AS no_show
    `,
    [
      salon.id,
    ]
  )

     const counts =
      countsResult.rows[0]

    console.log(
      '\nDemo dataset before commit:'
    )

    console.table([
      counts,
    ])

    if (
      counts.clients !==
        String(demoClients.length) ||
      counts.employees !==
        String(demoEmployees.length) ||
      counts.services !==
        String(demoServices.length) ||
      counts.appointments !==
        String(demoAppointments.length) ||
      counts.employee_services !==
        '25' ||
      counts.working_hours !==
        '19' ||
      counts.date_overrides !==
        String(demoDateOverrides.length) ||
      counts.time_off !==
        String(demoTimeOff.length) ||
      counts.blocked_times !==
        String(demoBlockedTimes.length) ||
      counts.completed !==
        '18' ||
      counts.confirmed !==
        '9' ||
      counts.pending !==
        '3' ||
      counts.cancelled !==
        '3' ||
      counts.no_show !==
        '2'
    ) {
      throw new Error(
        'Demo seed verification failed.'
      )
    }

    await client.query('COMMIT')

    console.log(
      '\nSalonAI realistic demo seed completed.'
    )
  } catch (error) {
    await client.query(
      'ROLLBACK'
    )

    console.error(
      '\nSalonAI realistic demo seed failed:'
    )

    console.error(
      error
    )

    process.exitCode =
      1
  } finally {
    client.release()

    await pool.end()
  }
}

seedDemo()