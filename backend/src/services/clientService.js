import {
  findClientsBySalonId,
  findClientById,
  insertClient,
  updateClient,
  updateClientActive,
  searchClientsForBooking,
} from '../repositories/clientRepository.js'

function createClientValidationError(message) {
  const error = new Error(message)
  error.code = 'INVALID_CLIENT_INPUT'
  error.statusCode = 400
  return error
}

function requirePositiveId(value, label) {
  const id = Number(value)

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createClientValidationError(
      `A valid ${label} ID is required.`
    )
  }

  return id
}

function clientNotFoundError() {
  const error = new Error(
    'Client not found for the selected salon.'
  )

  error.code = 'CLIENT_NOT_FOUND'
  error.statusCode = 404

  return error
}

function normalizeClientInput({
  name,
  isOccasional,
  phoneCountryCode,
  phoneNumber,
  phoneNormalized,
}) {
  if (typeof isOccasional !== 'boolean') {
    throw createClientValidationError(
      'is_occasional must be a boolean.'
    )
  }

  const cleanName =
    typeof name === 'string' ? name.trim() : ''

  if (!cleanName || cleanName.length > 150) {
    throw createClientValidationError(
      'Client name must contain 1 to 150 characters.'
    )
  }

  function cleanPhoneField(value) {
    if (value === undefined || value === null) {
      return null
    }

    if (typeof value !== 'string') {
      throw createClientValidationError(
        'Phone fields must be strings or null.'
      )
    }

    return value.trim() || null
  }

  const countryCode = cleanPhoneField(phoneCountryCode)
  const number = cleanPhoneField(phoneNumber)
  const normalized = cleanPhoneField(phoneNormalized)

  const hasNoPhone =
    countryCode === null &&
    number === null &&
    normalized === null

  if (hasNoPhone) {
    if (!isOccasional) {
      throw createClientValidationError(
        'A phone number is required for regular clients.'
      )
    }
  } else if (
    !countryCode ||
    !number ||
    !normalized ||
    countryCode.length > 10 ||
    number.length > 30 ||
    normalized.length > 30
  ) {
    throw createClientValidationError(
      'Valid, complete client phone fields are required.'
    )
  }

  return {
    name: cleanName,
    isOccasional,
    phoneCountryCode: countryCode,
    phoneNumber: number,
    phoneNormalized: normalized,
  }
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
  isOccasional = false,
}, db) {
  const normalizedSalonId =
    requirePositiveId(salonId, 'salon')

  const input = normalizeClientInput({
    name,
    isOccasional,
    phoneCountryCode,
    phoneNumber,
    phoneNormalized,
  })

  return insertClient({
    salonId: normalizedSalonId,
    ...input,
  }, db)
}

export async function updateClientForSalon({
  clientId,
  salonId,
  name,
  phoneCountryCode,
  phoneNumber,
  phoneNormalized,
  isOccasional,
}) {
  const normalizedClientId =
    requirePositiveId(clientId, 'client')

  const normalizedSalonId =
    requirePositiveId(salonId, 'salon')

  const existingClient = await findClientById(
    normalizedClientId,
    normalizedSalonId
  )

  if (!existingClient) {
    throw clientNotFoundError()
  }

  const effectiveIsOccasional =
    isOccasional === undefined
      ? existingClient.is_occasional
      : isOccasional

  const input = normalizeClientInput({
    name,
    isOccasional: effectiveIsOccasional,
    phoneCountryCode,
    phoneNumber,
    phoneNormalized,
  })

  const updatedClient = await updateClient({
    clientId: normalizedClientId,
    salonId: normalizedSalonId,
    ...input,

    // If omitted, preserve the stored classification in SQL.
    isOccasional,
  })

  if (!updatedClient) {
    throw clientNotFoundError()
  }

  return updatedClient
}

export async function updateClientActiveForSalon({
  clientId,
  salonId,
  active,
}) {
  const normalizedClientId =
    requirePositiveId(clientId, 'client')

  const normalizedSalonId =
    requirePositiveId(salonId, 'salon')

  if (typeof active !== 'boolean') {
    throw createClientValidationError(
      'active must be a boolean.'
    )
  }

  const updatedClient = await updateClientActive({
    clientId: normalizedClientId,
    salonId: normalizedSalonId,
    active,
  })

  if (!updatedClient) {
    throw clientNotFoundError()
  }

  return updatedClient
}

export async function searchBookingClientsForSalon({
  salonId,
  query,
}) {
  const normalizedSalonId = requirePositiveId(salonId, 'salon')

  if (typeof query !== 'string') {
    throw createClientValidationError(
      'Search query must be a string.'
    )
  }

  const cleanQuery = query.trim()

  if (cleanQuery.length > 100) {
    throw createClientValidationError(
      'Search query must contain at most 100 characters.'
    )
  }

  let nameQuery = null
  let phoneQuery = null

  const looksLikePhone =
    /^[+\d\s()-]+$/.test(cleanQuery)

  if (looksLikePhone) {
    const digits = cleanQuery.replace(/\D/g, '')

    if (digits.length < 7 || digits.length > 30) {
      throw createClientValidationError(
        'Phone search requires 7 to 30 digits.'
      )
    }

    // Lokalni broj 091... traži se bez početne nule.
    // Međunarodni zapis 00385... traži se bez početnog 00.
    phoneQuery = digits.startsWith('00')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits

    if (phoneQuery.length < 7) {
      throw createClientValidationError(
        'Phone search requires at least 7 significant digits.'
      )
    }
  } else {
    const letters = cleanQuery.match(/\p{L}/gu) ?? []

    if (letters.length < 3) {
      throw createClientValidationError(
        'Name search requires at least 3 letters.'
      )
    }

    nameQuery = cleanQuery
  }

  return searchClientsForBooking({
    salonId: normalizedSalonId,
    nameQuery,
    phoneQuery,
  })
}