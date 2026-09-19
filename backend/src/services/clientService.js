import {
  findClientsBySalonId,
  insertClient,
} from '../repositories/clientRepository.js'

function createClientValidationError(message) {
  const error = new Error(message)
  error.code = 'INVALID_CLIENT_INPUT'
  error.statusCode = 400
  return error
}

export async function getClientsForSalon(salonId) {
  return findClientsBySalonId(salonId)
}

export async function createClientForSalon({
  salonId,
  name,
  phoneCountryCode,
  phoneNumber,
  phoneNormalized,
}) {
  const normalizedSalonId = Number(salonId)

  if (
    !Number.isSafeInteger(normalizedSalonId) ||
    normalizedSalonId <= 0
  ) {
    throw createClientValidationError(
      'A valid salon ID is required.'
    )
  }

  const cleanName =
    typeof name === 'string' ? name.trim() : ''

  const cleanCountryCode =
    typeof phoneCountryCode === 'string'
      ? phoneCountryCode.trim()
      : ''

  const cleanPhoneNumber =
    typeof phoneNumber === 'string'
      ? phoneNumber.trim()
      : ''

  const cleanPhoneNormalized =
    typeof phoneNormalized === 'string'
      ? phoneNormalized.trim()
      : ''

  if (!cleanName || cleanName.length > 150) {
    throw createClientValidationError(
      'Client name must contain 1 to 150 characters.'
    )
  }

  if (
    !cleanCountryCode ||
    cleanCountryCode.length > 10 ||
    !cleanPhoneNumber ||
    cleanPhoneNumber.length > 30 ||
    !cleanPhoneNormalized ||
    cleanPhoneNormalized.length > 30
  ) {
    throw createClientValidationError(
      'Valid client phone fields are required.'
    )
  }

  return insertClient({
    salonId: normalizedSalonId,
    name: cleanName,
    phoneCountryCode: cleanCountryCode,
    phoneNumber: cleanPhoneNumber,
    phoneNormalized: cleanPhoneNormalized,
  })
}