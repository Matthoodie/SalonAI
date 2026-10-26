import { Router } from 'express'
import {
  listTimeOffRequests, getTimeOffRequest, createTimeOffRequest,
  withdrawTimeOffRequest, decideTimeOffRequest, cancelTimeOffRequest,
} from '../controllers/employeeTimeOffRequestController.js'

const router = Router()
router.get('/', listTimeOffRequests)
router.get('/:id', getTimeOffRequest)
router.post('/', createTimeOffRequest)
router.post('/:id/withdraw', withdrawTimeOffRequest)
router.post('/:id/decision', decideTimeOffRequest)
router.post('/:id/cancel', cancelTimeOffRequest)
export default router
