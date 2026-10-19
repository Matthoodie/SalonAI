export function mapClientToFrontend(client) {
  const phoneCountryCode =
    client.phone_country_code ?? null

  const phoneNumber =
    client.phone_number ?? null

  return {
    ...client,
    isOccasional: client.is_occasional === true,
    phoneCountryCode,
    phoneNumber,
    phoneNormalized: client.phone_normalized ?? null,
    phone: [
      phoneCountryCode,
      phoneNumber,
    ].filter(Boolean).join(' '),
  }
}

export function mapClientToPayload(client) {
  return {
    name: client.name,
    is_occasional: client.isOccasional === true,
    phone_country_code: client.phoneCountryCode ?? null,
    phone_number: client.phoneNumber ?? null,
    phone_normalized: client.phoneNormalized ?? null,
  }
}