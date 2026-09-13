export function mapServiceToFrontend(
  service
) {
  return {
    id:
      Number(service.id),

    salonId:
      Number(service.salon_id),

    name:
      service.name,

    category:
      service.category || 'Ostalo',

    price:
      service.price_cents / 100,

    priceCents:
      service.price_cents,

    defaultDurationMinutes:
      service.default_duration_minutes,

    active:
      service.active,

    createdAt:
      service.created_at,

    updatedAt:
      service.updated_at,
  }
}

export function mapServicesToFrontend(
  services
) {
  return services.map(
    mapServiceToFrontend
  )
}