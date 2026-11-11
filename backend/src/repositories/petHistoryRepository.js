import { appointmentItemsSql } from './appointmentItemRepository.js'
import { PET_HISTORY_PAGE_SIZE } from '../utils/petHistory.js'
export async function findPetHistory(db, { salonId, clientId, petId }, cursor) {
  const result = await db.query(`
    SELECT a.id, a.salon_id, a.client_id, a.pet_id,
      a.pet_name, a.pet_species, a.pet_breed,
      a.starts_at, a.ends_at, a.status, a.duration_minutes, a.price_cents,
      e.name AS employee_name, ${appointmentItemsSql} AS items,
      to_char(a.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_start
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id AND e.salon_id = a.salon_id
    WHERE a.salon_id = $1 AND a.client_id = $2 AND a.pet_id = $3 AND a.recipient_type = 'pet'
      AND ($4::timestamptz IS NULL OR (a.starts_at, a.id) < ($4::timestamptz, $5::bigint))
    ORDER BY a.starts_at DESC, a.id DESC LIMIT $6
  `, [salonId, clientId, petId, cursor?.start ?? null, cursor?.id ?? null, PET_HISTORY_PAGE_SIZE + 1])
  return result.rows
}
