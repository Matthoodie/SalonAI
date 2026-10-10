import {
  clerkClient,
} from '@clerk/express'

function createClerkIdentityError(
  message,
  code,
  statusCode
) {
  const error = new Error(message)

  error.code = code
  error.statusCode = statusCode

  return error
}

function getPrimaryEmailAddress(clerkUser) {
  const primaryEmailAddress =
    clerkUser.emailAddresses.find(
      (emailAddress) =>
        emailAddress.id ===
        clerkUser.primaryEmailAddressId
    )

  return primaryEmailAddress?.emailAddress ?? null
}

function getDisplayName(clerkUser) {
  const fullName = [
    clerkUser.firstName,
    clerkUser.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  if (fullName) {
    return fullName.slice(0, 150)
  }

  if (clerkUser.username) {
    return clerkUser.username
      .trim()
      .slice(0, 150)
  }

  return null
}

export async function getClerkIdentity(
  clerkUserId
) {
  if (
    typeof clerkUserId !== 'string' ||
    !clerkUserId.trim()
  ) {
    throw createClerkIdentityError(
      'A valid Clerk user ID is required.',
      'INVALID_AUTH_IDENTITY',
      400
    )
  }

  const clerkUser =
    await clerkClient.users.getUser(
      clerkUserId
    )

  const email =
    getPrimaryEmailAddress(clerkUser)

  if (!email) {
    throw createClerkIdentityError(
      'Authenticated Clerk user does not have a primary email address.',
      'AUTH_EMAIL_REQUIRED',
      422
    )
  }

  return {
    authProvider: 'clerk',
    authSubject: clerkUser.id,
    email,
    displayName:
       getDisplayName(clerkUser),
  }
}