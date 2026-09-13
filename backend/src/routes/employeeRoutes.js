import { Router } from 'express'

import {
  getEmployees,
} from '../controllers/employeeController.js'

const router = Router()

router.get(
  '/',
  getEmployees
)

export default router