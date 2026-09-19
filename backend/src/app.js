import express from 'express'

import appointmentRoutes from './routes/appointmentRoutes.js'
import availabilityRoutes from './routes/availabilityRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import calendarRoutes from './routes/calendarRoutes.js'
import serviceRoutes from './routes/serviceRoutes.js'
import employeeRoutes from './routes/employeeRoutes.js'
import clientRoutes from './routes/clientRoutes.js'

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
app.use('/api/bookings', bookingRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/clients', clientRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app