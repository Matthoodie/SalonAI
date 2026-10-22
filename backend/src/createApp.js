import express from 'express'

import appointmentRoutes from './routes/appointmentRoutes.js'
import authRoutes from './routes/authRoutes.js'
import availabilityRoutes from './routes/availabilityRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import calendarRoutes from './routes/calendarRoutes.js'
import serviceRoutes from './routes/serviceRoutes.js'
import employeeRoutes from './routes/employeeRoutes.js'
import clientRoutes from './routes/clientRoutes.js'
import healthRoutes from './routes/healthRoutes.js'
import invitationRoutes from './routes/invitationRoutes.js'

import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler.js'

export function createApp({
  authRouteMiddleware = [],
  privateRouteMiddleware = [],
  invitationRouter = invitationRoutes,
} = {}) {
  const app = express()

  app.use(express.json())

  app.use(
    '/api/health',
    healthRoutes
  )

  app.use(
    '/api/auth',
    ...authRouteMiddleware,
    authRoutes
  )

  app.use(
    '/api/invitations',
    ...authRouteMiddleware,
    invitationRouter
  )

  app.use(
    '/api/appointments',
    ...privateRouteMiddleware,
    appointmentRoutes
  )

  app.use(
    '/api/availability',
    availabilityRoutes
  )

  app.use(
    '/api/bookings',
    bookingRoutes
  )

  app.use(
    '/api/calendar',
    ...privateRouteMiddleware,
    calendarRoutes
  )

  app.use(
    '/api/services',
    ...privateRouteMiddleware,
    serviceRoutes
  )

  app.use(
    '/api/employees',
    ...privateRouteMiddleware,
    employeeRoutes
  )

  app.use(
    '/api/clients',
    ...privateRouteMiddleware,
    clientRoutes
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}