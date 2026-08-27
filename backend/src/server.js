import 'dotenv/config'

import app from './app.js'
import { checkDatabaseConnection } from './database/health.js'

const PORT = process.env.PORT || 3001

async function startServer() {
  try {
    const databaseHealth =
      await checkDatabaseConnection()

    console.log(
      'PostgreSQL connection successful:',
      databaseHealth.database_time
    )

    app.listen(PORT, () => {
      console.log(
        `SalonAI backend running on port ${PORT}`
      )
    })
  } catch (error) {
    console.error(
      'Failed to connect to PostgreSQL:',
      error
    )

    process.exit(1)
  }
}

startServer()