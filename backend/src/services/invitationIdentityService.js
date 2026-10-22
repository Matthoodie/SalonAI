import {
  clerkClient,
} from '@clerk/express'

function invitationIdentityError(message, code, statusCode) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

export function normalizeInvitationEmail(value) {
  if (typeof value !== 'string') {
    throw invitationIdentityError(
      'A valid invitation email is required.',
      'INVALID_INVITATION_EMAIL',
      400
    )
  }

  const email = value.trim().toLowerCase()

  if (
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw invitationIdentityError(
      'A valid invitation email is required.',
      'INVALID_INVITATION_EMAIL',
      400
    )
  }

  return email
}

export function createInvitationIdentityVerifier(loadClerkUser) {
  if (typeof loadClerkUser !== 'function') {
    throw new Error('A Clerk user loader is required.')
  }

  return async function verifyIdentity({
    currentUser,
    invitedEmail,
  }) {
    const numericUserId = Number(currentUser?.id)

    if (
      !['string', 'number'].includes(typeof currentUser?.id) ||
      !Number.isSafeInteger(numericUserId) ||
      numericUserId <= 0 ||
      currentUser?.active !== true ||
      currentUser?.auth_provider !== 'clerk' ||
      typeof currentUser?.auth_subject !== 'string' ||
      !currentUser.auth_subject.trim()
    ) {
      throw invitationIdentityError(
        'An active authenticated Clerk user is required.',
        'INVITATION_AUTH_IDENTITY_REQUIRED',
        403
      )
    }

    const normalizedInvitedEmail =
      normalizeInvitationEmail(invitedEmail)

    const authSubject = currentUser.auth_subject

    // Svaki poziv dohvaća aktualni identitet.
    // Lokalni users.email nije dokaz vlasništva emaila.
    const clerkUser = await loadClerkUser(authSubject)

    if (!clerkUser || clerkUser.id !== authSubject) {
      throw invitationIdentityError(
        'The identity provider returned an unexpected user.',
        'INVITATION_AUTH_IDENTITY_MISMATCH',
        403
      )
    }

    if (
      clerkUser.banned === true ||
      clerkUser.locked === true
    ) {
      throw invitationIdentityError(
        'This account cannot accept invitations.',
        'INVITATION_AUTH_ACCOUNT_UNAVAILABLE',
        403
      )
    }

    const primaryEmail = Array.isArray(clerkUser.emailAddresses)
      ? clerkUser.emailAddresses.find(
          (item) =>
            item.id === clerkUser.primaryEmailAddressId
        )
      : null

    if (
      !primaryEmail ||
      primaryEmail.verification?.status !== 'verified'
    ) {
      throw invitationIdentityError(
        'Verify your primary email before accepting this invitation.',
        'INVITATION_VERIFIED_EMAIL_REQUIRED',
        403
      )
    }

    let verifiedEmail

    try {
      verifiedEmail = normalizeInvitationEmail(
        primaryEmail.emailAddress
      )
    } catch {
      throw invitationIdentityError(
        'A valid verified primary email is required.',
        'INVITATION_VERIFIED_EMAIL_REQUIRED',
        403
      )
    }

    if (verifiedEmail !== normalizedInvitedEmail) {
      throw invitationIdentityError(
        'Sign in with the account whose verified primary email matches this invitation.',
        'INVITATION_EMAIL_MISMATCH',
        403
      )
    }

    return {
      userId: numericUserId,
      authSubject,
      verifiedEmail,
    }
  }
}

export const verifyInvitationIdentity =
  createInvitationIdentityVerifier(
    (authSubject) =>
      clerkClient.users.getUser(authSubject)
  )