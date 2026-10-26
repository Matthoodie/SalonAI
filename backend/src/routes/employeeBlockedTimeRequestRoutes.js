import { Router } from 'express'
import {
  listBlockedTimeRequests, getBlockedTimeRequest, createBlockedTimeRequest,
  withdrawBlockedTimeRequest, decideBlockedTimeRequest, cancelBlockedTimeRequest,
} from '../controllers/employeeBlockedTimeRequestController.js'

const router = Router()
router.get('/', listBlockedTimeRequests)
router.get('/:id', getBlockedTimeRequest)
router.post('/', createBlockedTimeRequest)
router.post('/:id/withdraw', withdrawBlockedTimeRequest)
router.post('/:id/decision', decideBlockedTimeRequest)
router.post('/:id/cancel', cancelBlockedTimeRequest)
export default router
