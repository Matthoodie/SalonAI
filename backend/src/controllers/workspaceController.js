import {
  getAvailableSalonContexts,
} from '../services/currentSalonService.js'

export async function getAvailableWorkspaces(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store')

    const user = req.currentUser

    const contexts = await getAvailableSalonContexts(
      user?.id
    )

    return res.status(200).json({
      data: {
        authenticated: true,

        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          active: user.active,
        },

        workspaces: contexts.map(({ salon, membership }) => ({
          salon: {
            id: salon.id,
            name: salon.name,
            timezone: salon.timezone,
            active: salon.active,
          },

          membership: {
            id: membership.id,
            role: membership.role,
            employee_id: membership.employeeId,
            active: membership.active,
          },
        })),
      },
    })
  } catch (error) {
    return next(error)
  }
}