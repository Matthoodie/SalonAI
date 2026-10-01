import { Router } from 'express'

import {
  getClients,
  createClient,
  updateClient,
  updateClientActive,
} from '../controllers/clientController.js'

const router = Router()

router.get('/', getClients)

router.post('/', createClient)

router.patch('/:id', updateClient)

router.patch('/:id/active', updateClientActive)

export default router