import {
  getSalonMembers,
} from '../services/salonMemberService.js'

export async function listSalonMembers(req, res, next) {
  try {
    const members = await getSalonMembers({
      salonId: req.currentSalon?.id,
      membership: req.currentMembership,
    })

    return res.status(200).json({
      data: {
        members,
      },
    })
  } catch (error) {
    return next(error)
  }
}