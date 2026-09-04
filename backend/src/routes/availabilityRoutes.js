import { Router } from 'express'

import {
    getAvailability,
} from '../controllers/availabilityController.js'

const router = Router()

router.get('/', getAvailability)

export default router