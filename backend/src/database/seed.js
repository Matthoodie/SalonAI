import pool from './pool.js'

async function seed() {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        console.log('Starting SalonAI development seed...')

        let salonResult = await client.query(`
      SELECT id, name
      FROM salons
      WHERE name = 'SalonAI Demo Salon'
      ORDER BY id
      LIMIT 1
    `)

        let salon = salonResult.rows[0]

        if (!salon) {
            salonResult = await client.query(`
        INSERT INTO salons (
          name
        )
        VALUES (
          'SalonAI Demo Salon'
        )
        RETURNING id, name
      `)

            salon = salonResult.rows[0]
        }

        console.log(
            `Using salon: ${salon.name} (id=${salon.id})`
        )

        let clientResult = await client.query(
            `
        SELECT id, name, phone_normalized
        FROM clients
        WHERE salon_id = $1
          AND phone_normalized = $2
        ORDER BY id
        LIMIT 1
      `,
            [
                salon.id,
                '+385911111111',
            ]
        )

        let seededClient = clientResult.rows[0]

        if (!seededClient) {
            clientResult = await client.query(
                `
          INSERT INTO clients (
            salon_id,
            name,
            phone_country_code,
            phone_number,
            phone_normalized
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          RETURNING id, name, phone_normalized
        `,
                [
                    salon.id,
                    'Demo Client',
                    '+385',
                    '911111111',
                    '+385911111111',
                ]
            )

            seededClient = clientResult.rows[0]
        }

        console.log(
            `Using client: ${seededClient.name} (id=${seededClient.id})`
        )

        let employeeResult = await client.query(
            `
    SELECT id, name
    FROM employees
    WHERE salon_id = $1
      AND name = $2
    ORDER BY id
    LIMIT 1
  `,
            [
                salon.id,
                'Demo Employee',
            ]
        )

        let seededEmployee = employeeResult.rows[0]

        if (!seededEmployee) {
            employeeResult = await client.query(
                `
      INSERT INTO employees (
        salon_id,
        name
      )
      VALUES (
        $1,
        $2
      )
      RETURNING id, name
    `,
                [
                    salon.id,
                    'Demo Employee',
                ]
            )

            seededEmployee = employeeResult.rows[0]
        }

        console.log(
            `Using employee: ${seededEmployee.name} (id=${seededEmployee.id})`
        )


        let serviceResult = await client.query(
            `
    SELECT
      id,
      name,
      category,
      price_cents,
      default_duration_minutes
    FROM services
    WHERE salon_id = $1
      AND name = $2
    ORDER BY id
    LIMIT 1
  `,
            [
                salon.id,
                'Demo Service',
            ]
        )

        let seededService = serviceResult.rows[0]

        if (!seededService) {
            serviceResult = await client.query(
                `
      INSERT INTO services (
        salon_id,
        name,
        category,
        price_cents,
        default_duration_minutes
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      RETURNING
        id,
        name,
        category,
        price_cents,
        default_duration_minutes
    `,
                [
                    salon.id,
                    'Demo Service',
                    'Demo',
                    2500,
                    30,
                ]
            )

            seededService = serviceResult.rows[0]
        }

        console.log(
            `Using service: ${seededService.name} (id=${seededService.id})`
        )

        let employeeServiceResult = await client.query(
            `
    SELECT
      employee_id,
      service_id,
      salon_id
    FROM employee_services
    WHERE employee_id = $1
      AND service_id = $2
      AND salon_id = $3
    LIMIT 1
  `,
            [
                seededEmployee.id,
                seededService.id,
                salon.id,
            ]
        )

        let seededEmployeeService = employeeServiceResult.rows[0]

        if (!seededEmployeeService) {
            employeeServiceResult = await client.query(
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
      RETURNING
        employee_id,
        service_id,
        salon_id
    `,
                [
                    seededEmployee.id,
                    seededService.id,
                    salon.id,
                ]
            )

            seededEmployeeService = employeeServiceResult.rows[0]
        }

        console.log(
            `Using employee-service link: employee=${seededEmployeeService.employee_id}, service=${seededEmployeeService.service_id}, salon=${seededEmployeeService.salon_id}`
        )

        const workingHours = [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
        ]

        for (const workingHour of workingHours) {
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
      ON CONFLICT (employee_id, day_of_week)
      DO UPDATE SET
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        updated_at = CURRENT_TIMESTAMP
    `,
                [
                    seededEmployee.id,
                    workingHour.dayOfWeek,
                    workingHour.startTime,
                    workingHour.endTime,
                ]
            )
        }

        console.log(
            `Using working hours: employee=${seededEmployee.id}, Monday-Friday 09:00-17:00`
        )

        let appointmentResult = await client.query(
            `
    SELECT
      id,
      salon_id,
      client_id,
      employee_id,
      service_id,
      starts_at,
      ends_at,
      price_cents,
      duration_minutes,
      status,
      source
    FROM appointments
    WHERE salon_id = $1
      AND client_id = $2
      AND employee_id = $3
      AND service_id = $4
      AND starts_at = $5
      AND ends_at = $6
    ORDER BY id
    LIMIT 1
  `,
            [
                salon.id,
                seededClient.id,
                seededEmployee.id,
                seededService.id,
                '2026-10-05 10:00:00+02',
                '2026-10-05 10:30:00+02',
            ]
        )

        let seededAppointment = appointmentResult.rows[0]

        if (!seededAppointment) {
            appointmentResult = await client.query(
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
      RETURNING
        id,
        salon_id,
        client_id,
        employee_id,
        service_id,
        starts_at,
        ends_at,
        price_cents,
        duration_minutes,
        status,
        source
    `,
                [
                    salon.id,
                    seededClient.id,
                    seededEmployee.id,
                    seededService.id,
                    '2026-10-05 10:00:00+02',
                    '2026-10-05 10:30:00+02',
                    2500,
                    30,
                    'confirmed',
                    'manual',
                    'SalonAI development seed appointment',
                ]
            )

            seededAppointment = appointmentResult.rows[0]
        }

        console.log(
            `Using appointment: id=${seededAppointment.id}, employee=${seededAppointment.employee_id}, service=${seededAppointment.service_id}`
        )

        await client.query('COMMIT')

        console.log('SalonAI development seed completed.')
    } catch (error) {
        await client.query('ROLLBACK')

        console.error(
            'SalonAI development seed failed:',
            error
        )

        process.exitCode = 1
    } finally {
        client.release()
        await pool.end()
    }
}

seed()