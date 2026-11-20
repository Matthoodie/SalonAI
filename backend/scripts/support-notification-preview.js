import pool from '../src/database/pool.js'
import {notificationPreviewArgs} from '../src/utils/supportNotification.js'
import {previewSupportNotifications} from '../src/services/supportNotificationPreviewService.js'

try {
  const options=notificationPreviewArgs(process.argv.slice(2))
  console.log(JSON.stringify(await previewSupportNotifications(pool,options),null,2))
} catch {
  // Do not print connection strings, query parameters or raw database errors.
  console.error('Preview failed. Check migrations, database access and --database NAME [--before ID]. No messages were sent.')
  process.exitCode=1
} finally { await pool.end() }
