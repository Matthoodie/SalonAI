import express from 'express'

import appointmentRoutes from './routes/appointmentRoutes.js'
import availabilityRoutes from './routes/availabilityRoutes.js'

import healthRoutes from './routes/healthRoutes.js'

import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler.js'

const app = express()

app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/availability', availabilityRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app