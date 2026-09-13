import { Router } from 'express'

import {
  getEmployees,
  createEmployee,
  updateEmployee,
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

export default router