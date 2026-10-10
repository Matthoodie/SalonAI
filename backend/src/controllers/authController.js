export function getCurrentAuth(
  req,
  res
) {
  const currentUser =
    req.currentUser

  const currentSalon =
    req.currentSalon

  const currentMembership =
    req.currentMembership

  return res.status(200).json({
    data: {
      authenticated: true,

      user: {
        id: currentUser.id,
        email: currentUser.email,
        display_name:
          currentUser.display_name,
        active:
          currentUser.active,
      },

      current_salon: {
        id: currentSalon.id,
        name: currentSalon.name,
        timezone:
          currentSalon.timezone,
        active:
          currentSalon.active,
      },

      membership: {
        id: currentMembership.id,
        role:
          currentMembership.role,
        active:
          currentMembership.active,
      },
    },
  })
}