import {
  findUserByAuthIdentity,
  insertUserFromAuthIdentity,
} from '../repositories/userRepository.js'

import {
  getClerkIdentity,
} from './clerkIdentityService.js'

const AUTH_PROVIDER = 'clerk'

function createAuthenticatedIdentityError(
  message,
  code,
  statusCode
) {
  const error = new Error(message)

  error.code = code
  error.statusCode = statusCode

  return error
}

function assertUserIsActive(user) {
  if (!user.active) {
    throw createAuthenticatedIdentityError(
      'This SalonAI user account is inactive.',
      'USER_INACTIVE',
      403
    )
  }

  return user
}

export async function resolveAuthenticatedUser(
  clerkUserId
) {
  if (
    typeof clerkUserId !== 'string' ||
    !clerkUserId.trim()
  ) {
    throw createAuthenticatedIdentityError(
      'A valid authenticated user ID is required.',
      'INVALID_AUTH_IDENTITY',
      400
    )
  }

  const authSubject =
    clerkUserId.trim()

  const existingUser =
    await findUserByAuthIdentity({
      authProvider: AUTH_PROVIDER,
      authSubject,
    })

  if (existingUser) {
    return assertUserIsActive(
      existingUser
    )
  }

  const identity =
    await getClerkIdentity(
      authSubject
    )

  const createdUser =
    await insertUserFromAuthIdentity(
      identity
    )

  if (createdUser) {
    return assertUserIsActive(
      createdUser
    )
  }

  const concurrentUser =
    await findUserByAuthIdentity({
      authProvider: AUTH_PROVIDER,
      authSubject,
    })

  if (!concurrentUser) {
    throw createAuthenticatedIdentityError(
      'Authenticated user could not be resolved.',
      'AUTH_USER_PROVISIONING_FAILED',
      500
    )
  }

  return assertUserIsActive(
    concurrentUser
  )
}