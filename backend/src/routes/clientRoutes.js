import { Router } from 'express'

import {
  getClients,
  createClient,
  updateClient,
} from '../controllers/clientController.js'

const router = Router()

router.get('/', getClients)

router.post('/', createClient)

router.patch('/:id', updateClient)

export default router