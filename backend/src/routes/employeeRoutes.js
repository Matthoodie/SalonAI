import { Router } from 'express'

import {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeActive,
} from '../controllers/employeeController.js'

import {
  requireSalonRole,
} from '../middleware/roleMiddleware.js'

const router = Router()

router.get(
  '/',
  getEmployees
)

router.post(
  '/',
  requireSalonRole('owner', 'admin'),
  createEmployee
)

router.patch(
  '/:id',
  requireSalonRole('owner', 'admin'),
  updateEmployee
)

router.patch(
  '/:id/active',
  requireSalonRole('owner', 'admin'),
  updateEmployeeActive
)

export default router