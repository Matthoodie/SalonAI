import {
  findMembersBySalonId,
} from '../repositories/salonMembershipRepository.js'

function accessDenied() {
  const error = new Error(
    'Your salon membership does not allow viewing members.'
  )

  error.code = 'SALON_MEMBER_ACCESS_DENIED'
  error.statusCode = 403

  return error
}

export async function getSalonMembers({
  salonId,
  membership,
}) {
  const numericSalonId = Number(salonId)

  if (
    !Number.isSafeInteger(numericSalonId) ||
    numericSalonId <= 0 ||
    membership?.active !== true ||
    Number(membership.salonId) !== numericSalonId ||
    !['owner', 'admin'].includes(membership.role)
  ) {
    throw accessDenied()
  }

  return findMembersBySalonId(numericSalonId)
}