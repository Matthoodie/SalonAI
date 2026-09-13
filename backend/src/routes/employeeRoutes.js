import { Router } from 'express'

import {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeActive,
} from '../controllers/employeeController.js'

const router = Router()

router.get(
  '/',
  getEmployees
)

router.post(
  '/',
  createEmployee
)

router.patch(
  '/:id',
  updateEmployee
)

router.patch(
  '/:id/active',
  updateEmployeeActive
)

export default router