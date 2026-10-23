import {
  resolveAppointmentPermissions,
} from '../services/salonPermissionService.js'

export async function getCurrentAuth(req, res, next) {
  res.set('Cache-Control', 'no-store')

  try {
    const currentUser = req.currentUser
    const currentSalon = req.currentSalon
    const currentMembership = req.currentMembership

    const permissions = await resolveAppointmentPermissions({
      salonId: currentSalon.id,
      role: currentMembership.role,
      membershipId: currentMembership.id,
    })

    return res.status(200).json({
      data: {
        authenticated: true,

        user: {
          id: currentUser.id,
          email: currentUser.email,
          display_name: currentUser.display_name,
          active: currentUser.active,
        },

        current_salon: {
          id: currentSalon.id,
          name: currentSalon.name,
          timezone: currentSalon.timezone,
          active: currentSalon.active,
        },

        membership: {
          id: currentMembership.id,
          role: currentMembership.role,
          employee_id: currentMembership.employeeId,
          active: currentMembership.active,
        },

        permissions,
      },
    })
  } catch (error) {
    next(error)
  }
}