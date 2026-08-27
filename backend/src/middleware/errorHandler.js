export function notFoundHandler(
  req,
  res
) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Requested resource was not found.',
    },
  })
}

export function errorHandler(
  error,
  req,
  res,
  next
) {
  console.error(error)

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  })
}