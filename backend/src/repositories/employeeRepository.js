import pool from '../database/pool.js'

export async function findEmployeeForUpdate(
  client,
  {
    employeeId,
    salonId,
  }
) {
  const result = await client.query(
    `
      SELECT
        id,
        salon_id,
        name,
        active
      FROM employees
      WHERE id = $1
        AND salon_id = $2
      FOR UPDATE
    `,
    [
      employeeId,
      salonId,
    ]
  )

  return result.rows[0] ?? null
}

export async function findEmployeesBySalonId(
  salonId
) {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.salon_id,
        e.name,
        e.active,
        e.created_at,
        e.updated_at,

        COALESCE(
          (
            SELECT json_agg(
              es.service_id
              ORDER BY es.service_id
            )
            FROM employee_services es
            WHERE es.employee_id = e.id
              AND es.salon_id = e.salon_id
          ),
          '[]'::json
        ) AS service_ids,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'day_of_week',
                ewh.day_of_week,
                'start_time',
                ewh.start_time,
                'end_time',
                ewh.end_time
              )
              ORDER BY ewh.day_of_week
            )
            FROM employee_working_hours ewh
            WHERE ewh.employee_id = e.id
          ),
          '[]'::json
        ) AS working_hours,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'date',
                edo.date,
                'enabled',
                edo.enabled,
                'start_time',
                edo.start_time,
                'end_time',
                edo.end_time
              )
              ORDER BY edo.date
            )
            FROM employee_date_overrides edo
            WHERE edo.employee_id = e.id
          ),
          '[]'::json
        ) AS date_overrides,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id',
                eto.id,
                'start_date',
                eto.start_date,
                'end_date',
                eto.end_date,
                'type',
                eto.type,
                'note',
                eto.note
              )
              ORDER BY eto.start_date
            )
            FROM employee_time_off eto
            WHERE eto.employee_id = e.id
          ),
          '[]'::json
        ) AS time_off,

              COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id',
                ebt.id,
                'starts_at',
                ebt.starts_at,
                'ends_at',
                ebt.ends_at,
                'type',
                ebt.type,
                'reason',
                ebt.reason
              )
              ORDER BY ebt.starts_at
            )
            FROM employee_blocked_times ebt
            WHERE ebt.employee_id = e.id
          ),
          '[]'::json
        ) AS blocked_times
      FROM employees e
      WHERE e.salon_id = $1
      ORDER BY e.name ASC
    `,
    [salonId]
  )

  return result.rows
}

export async function insertEmployee(
  client,
  {
    salonId,
    name,
    active = true,
  }
) {
  const result = await client.query(
    `
      INSERT INTO employees (
        salon_id,
        name,
        active
      )
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [
      salonId,
      name,
      active,
    ]
  )

  return result.rows[0]
}

export async function insertEmployeeServices(
  client,
  {
    employeeId,
    salonId,
    serviceIds,
  }
) {
  for (const serviceId of serviceIds) {
    await client.query(
      `
        INSERT INTO employee_services (
          employee_id,
          service_id,
          salon_id
        )
        VALUES ($1, $2, $3)
      `,
      [
        employeeId,
        serviceId,
        salonId,
      ]
    )
  }
}

export async function findEmployeeServiceIds(
  client,
  employeeId
) {
  const result = await client.query(
    `
      SELECT service_id
      FROM employee_services
      WHERE employee_id = $1
      ORDER BY service_id
    `,
    [employeeId]
  )

  return result.rows.map(
    (row) => Number(row.service_id)
  )
}

export async function deleteEmployeeService(
  client,
  {
    employeeId,
    serviceId,
  }
) {
  await client.query(
    `
      DELETE FROM employee_services
      WHERE employee_id = $1
        AND service_id = $2
    `,
    [
      employeeId,
      serviceId,
    ]
  )
}

export async function insertEmployeeWorkingHours(
  client,
  {
    employeeId,
    workingHours,
  }
) {
  for (const workingHour of workingHours) {
    await client.query(
      `
        INSERT INTO employee_working_hours (
          employee_id,
          day_of_week,
          start_time,
          end_time
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        employeeId,
        workingHour.day_of_week,
        workingHour.start_time,
        workingHour.end_time,
      ]
    )
  }
}

export async function insertEmployeeDateOverrides(
  client,
  {
    employeeId,
    dateOverrides,
  }
) {
  for (const override of dateOverrides) {
    await client.query(
      `
        INSERT INTO employee_date_overrides (
          employee_id,
          date,
          enabled,
          start_time,
          end_time
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        employeeId,
        override.date,
        override.enabled,
        override.start_time,
        override.end_time,
      ]
    )
  }
}

export async function insertEmployeeTimeOff(
  client,
  {
    employeeId,
    timeOff,
  }
) {
  for (const item of timeOff) {
    await client.query(
      `
        INSERT INTO employee_time_off (
          employee_id,
          start_date,
          end_date,
          type,
          note
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        employeeId,
        item.start_date,
        item.end_date,
        item.type,
        item.note ?? null,
      ]
    )
  }
}

export async function insertEmployeeBlockedTimes(
  client,
  {
    employeeId,
    blockedTimes,
  }
) {
  for (const item of blockedTimes) {
    await client.query(
  `
    INSERT INTO employee_blocked_times (
      employee_id,
      starts_at,
      ends_at,
      type,
      reason
    )
    VALUES ($1, $2, $3, $4, $5)
  `,
  [
    employeeId,
    item.starts_at,
    item.ends_at,
    item.type,
    item.reason ?? null,
  ]
)
  }
}

export async function updateEmployee(
  client,
  {
    employeeId,
    salonId,
    name,
    active,
  }
) {
  const result = await client.query(
    `
      UPDATE employees
      SET
        name = $3,
        active = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND salon_id = $2
      RETURNING *
    `,
    [
      employeeId,
      salonId,
      name,
      active,
    ]
  )

  return result.rows[0] ?? null
}

export async function deleteEmployeeServices(
  client,
  employeeId
) {
  await client.query(
    `
      DELETE FROM employee_services
      WHERE employee_id = $1
    `,
    [employeeId]
  )
}

export async function deleteEmployeeWorkingHours(
  client,
  employeeId
) {
  await client.query(
    `
      DELETE FROM employee_working_hours
      WHERE employee_id = $1
    `,
    [employeeId]
  )
}

export async function deleteEmployeeDateOverrides(
  client,
  employeeId
) {
  await client.query(
    `
      DELETE FROM employee_date_overrides
      WHERE employee_id = $1
    `,
    [employeeId]
  )
}

export async function deleteEmployeeTimeOff(
  client,
  employeeId
) {
  await client.query(
    `
      DELETE FROM employee_time_off
      WHERE employee_id = $1
    `,
    [employeeId]
  )
}

export async function deleteEmployeeBlockedTimes(
  client,
  employeeId
) {
  await client.query(
    `
      DELETE FROM employee_blocked_times
      WHERE employee_id = $1
    `,
    [employeeId]
  )
}

export async function updateEmployeeActive(
  client,
  {
    employeeId,
    salonId,
    active,
  }
) {
  const result = await client.query(
    `
      UPDATE employees
      SET
        active = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND salon_id = $2
      RETURNING *
    `,
    [
      employeeId,
      salonId,
      active,
    ]
  )

  return result.rows[0] ?? null
}