import {
  getPermissionManagementSettings,
  getPermissionChangeHistory,
  setMemberPermission,
  setPermissionAdminDelegation,
} from '../services/salonPermissionManagementService.js'

export async function getPermissionSettings(req, res, next) {
  try {
    const result = await getPermissionManagementSettings({
      salonId: req.currentSalon?.id,
      actorUserId: req.currentUser?.id,
    })

    return res.status(200).json({
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function changeMemberPermission(req, res, next) {
  try {
    const result = await setMemberPermission({
      salonId: req.currentSalon?.id,
      actorUserId: req.currentUser?.id,
      membershipId: req.params.id,
      permissionKey: req.body?.permission_key,
      value: req.body?.value,
    })

    return res.status(200).json({
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function changePermissionDelegation(req, res, next) {
  try {
    const result = await setPermissionAdminDelegation({
      salonId: req.currentSalon?.id,
      actorUserId: req.currentUser?.id,
      permissionKey: req.body?.permission_key,
      enabled: req.body?.enabled,
    })

    return res.status(200).json({
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}


export async function listPermissionHistory(req, res, next) {
  try {
    const result = await getPermissionChangeHistory({
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