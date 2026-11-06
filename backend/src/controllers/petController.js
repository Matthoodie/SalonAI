import {petContext,petId} from '../utils/petValidation.js'
import {getClientPets,createClientPet,updateClientPet,setClientPetActive} from '../services/petService.js'
function controller(action,status=200,withPet=false) {
  return async(req,res,next)=>{
    res.set('Cache-Control','no-store')
    try {
      const context={...petContext(req),clientId:petId(req.params.clientId),body:req.body}
      if(withPet)context.petId=petId(req.params.petId)
      res.status(status).json({data:await action(context)})
    } catch(error){next(error)}
  }
}
export const getPets=controller(getClientPets)
export const createPet=controller(createClientPet,201)
export const updatePet=controller(updateClientPet,200,true)
export const setPetActive=controller(setClientPetActive,200,true)
