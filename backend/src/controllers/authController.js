export function getCurrentAuth(
  req,
  res
) {
  const currentUser =
    req.currentUser

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
    },
  })
}