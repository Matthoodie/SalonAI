import petPhotoRoutes from './petPhotoRoutes.js'
import {Router} from 'express'
import {getPets,createPet,updatePet,setPetActive} from '../controllers/petController.js'
import {requireSalonRole} from '../middleware/roleMiddleware.js'
const router=Router()
router.use(requireSalonRole('owner','admin'))
router.use(petPhotoRoutes)
router.get('/:clientId/pets',getPets)
router.post('/:clientId/pets',createPet)
router.put('/:clientId/pets/:petId',updatePet)
router.patch('/:clientId/pets/:petId/active',setPetActive)
export default router
