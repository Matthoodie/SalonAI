import { capacityError } from '../utils/capacityCalendar.js'
const limit=25000
async function rows(db,sql,args,max=limit) {
  const result=await db.query(sql,args)
  if(result.rows.length>max)throw capacityError('CAPACITY_LIMIT_EXCEEDED')
  return result.rows
}
export async function readCapacityAccess(db,{salonId,userId}) {
  return (await db.query(`SELECT s.id,s.timezone FROM salons s
    JOIN salon_memberships m ON m.salon_id=s.id JOIN users u ON u.id=m.user_id
    WHERE s.id=$1 AND u.id=$2 AND s.active AND u.active AND m.active
      AND m.role IN ('owner','admin')`,[salonId,userId])).rows[0]??null
}
export async function readCapacitySnapshot(db,salonId,timezone,dates,range) {
  const employees=await rows(db,`SELECT id,salon_id,name,active FROM employees
    WHERE salon_id=$1 AND active ORDER BY id LIMIT 101`,[salonId],100)
  const join=`JOIN employees e ON e.id=r.employee_id WHERE e.salon_id=$1 AND e.active`
  const weekly=await rows(db,`SELECT r.employee_id,e.salon_id,r.day_of_week,r.start_time::text,r.end_time::text
    FROM employee_working_hours r ${join} ORDER BY r.employee_id,r.day_of_week LIMIT 25001`,[salonId])
  const overrides=await rows(db,`SELECT r.employee_id,e.salon_id,r.date::text,r.enabled,r.start_time::text,r.end_time::text
    FROM employee_date_overrides r ${join} AND r.date BETWEEN $2::date AND $3::date
    ORDER BY r.employee_id,r.date LIMIT 25001`,[salonId,dates[0],dates.at(-1)])
  const timeOff=await rows(db,`SELECT r.employee_id,e.salon_id,r.start_date::text,r.end_date::text
    FROM employee_time_off r ${join} AND r.start_date<=$3::date AND r.end_date>=$2::date
    ORDER BY r.employee_id,r.start_date,r.id LIMIT 25001`,[salonId,dates[0],dates.at(-1)])
  const blocks=await rows(db,`SELECT r.employee_id,e.salon_id,r.starts_at,r.ends_at
    FROM employee_blocked_times r ${join} AND r.starts_at<$3::timestamptz AND r.ends_at>$2::timestamptz
    ORDER BY r.employee_id,r.starts_at,r.id LIMIT 25001`,[salonId,range.starts_at,range.ends_at])
  const appointments=await rows(db,`SELECT r.id,r.employee_id,r.salon_id,r.starts_at,r.ends_at,r.status
    FROM appointments r ${join} AND r.salon_id=$1 AND r.status<>'cancelled'
    AND r.starts_at<$3::timestamptz AND r.ends_at>$2::timestamptz
    ORDER BY r.employee_id,r.starts_at,r.id LIMIT 25001`,[salonId,range.starts_at,range.ends_at])
  const utc=items=>items.map(r=>({...r,starts_at:new Date(r.starts_at).toISOString(),ends_at:new Date(r.ends_at).toISOString()}))
  return {salon_id:salonId,timezone,employees,weekly,overrides,timeOff,blocks:utc(blocks),appointments:utc(appointments)}
}
