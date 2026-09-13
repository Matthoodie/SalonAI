import { mapDatabaseError } from '../errors/databaseErrorMapper.js'

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

  const mappedError = mapDatabaseError(error)

  if (mappedError) {
    return res.status(mappedError.status).json({
      error: {
        code: mappedError.code,
        message: mappedError.message,
      },
    })
  }

  if (
    Number.isSafeInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599 &&
    error.code
  ) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message:
          error.message ||
          'Request failed.',
      },
    })
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  })
}