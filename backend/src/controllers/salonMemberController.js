import {
  getSalonMemberHistory,
} from '../services/salonMemberHistoryService.js'


import {
  getSalonMembers,
} from '../services/salonMemberService.js'

import {
  updateSalonMemberRole,
  updateSalonMemberActive,
} from '../services/salonMemberManagementService.js'

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

export async function changeSalonMemberRole(req, res, next) {
  try {
    const result = await updateSalonMemberRole({
      salonId: req.currentSalon?.id,
      actorUserId: req.currentUser?.id,
      membershipId: req.params.id,
      role: req.body?.role,
    })

    return res.status(200).json({
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function changeSalonMemberActive(req, res, next) {
  try {
    const result = await updateSalonMemberActive({
      salonId: req.currentSalon?.id,
      actorUserId: req.currentUser?.id,
      membershipId: req.params.id,
      active: req.body?.active,
    })

    return res.status(200).json({
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}


export async function listSalonMemberHistory(req, res, next) {
  try {
    const result = await getSalonMemberHistory({
      salonId: req.currentSalon?.id,
      actorUserId: req.currentUser?.id,
      beforeId: req.query?.before_id,
    })

    return res.status(200).json({
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}