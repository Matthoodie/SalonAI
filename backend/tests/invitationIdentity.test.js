import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeInvitationEmail,
  createInvitationIdentityVerifier,
} from '../src/services/invitationIdentityService.js'

function makeLocalUser() {
  return {
    id: '17',
    auth_provider: 'clerk',
    auth_subject: 'user_invitation_test',
    email: 'old-address@example.test',
    active: true,
  }
}

function makeClerkUser() {
  return {
    id: 'user_invitation_test',
    primaryEmailAddressId: 'email_primary',
    banned: false,
    locked: false,
    emailAddresses: [
      {
        id: 'email_primary',
        emailAddress: 'Member@example.test',
        verification: {
          status: 'verified',
        },
      },
    ],
  }
}

test('invitation identity: email normalization preserves dots and plus tags', () => {
  assert.equal(
    normalizeInvitationEmail('  Member.Name+Team@Example.test  '),
    'member.name+team@example.test'
  )

  for (const invalid of [
    null,
    undefined,
    '',
    ' ',
    'missing-at',
    'a@@example.test',
    'a b@example.test',
    `${'a'.repeat(321)}@example.test`,
  ]) {
    assert.throws(
      () => normalizeInvitationEmail(invalid),
      { code: 'INVALID_INVITATION_EMAIL' }
    )
  }
})

test('invitation identity: accepts fresh verified primary email despite stale local email', async () => {
  let requestedSubject

  const verify = createInvitationIdentityVerifier(
    async (subject) => {
      requestedSubject = subject
      return makeClerkUser()
    }
  )

  const result = await verify({
    currentUser: makeLocalUser(),
    invitedEmail: ' MEMBER@example.test ',
  })

  assert.equal(requestedSubject, 'user_invitation_test')

  assert.deepEqual(result, {
    userId: 17,
    authSubject: 'user_invitation_test',
    verifiedEmail: 'member@example.test',
  })
})

test('invitation identity: matching local email does not replace verified provider identity', async () => {
  const user = makeLocalUser()
  user.email = 'invited@example.test'

  const verify = createInvitationIdentityVerifier(
    async () => makeClerkUser()
  )

  await assert.rejects(
    () => verify({
      currentUser: user,
      invitedEmail: 'invited@example.test',
    }),
    {
      code: 'INVITATION_EMAIL_MISMATCH',
      statusCode: 403,
    }
  )
})

test('invitation identity: missing or unverified primary email is rejected', async () => {
  for (const status of [undefined, null, 'unverified', 'expired']) {
    const clerkUser = makeClerkUser()

    clerkUser.emailAddresses[0].verification =
      status === null ? null : { status }

    const verify = createInvitationIdentityVerifier(
      async () => clerkUser
    )

    await assert.rejects(
      () => verify({
        currentUser: makeLocalUser(),
        invitedEmail: 'member@example.test',
      }),
      { code: 'INVITATION_VERIFIED_EMAIL_REQUIRED' }
    )
  }

  const clerkUser = makeClerkUser()
  clerkUser.primaryEmailAddressId = 'missing_email'

  const verify = createInvitationIdentityVerifier(
    async () => clerkUser
  )

  await assert.rejects(
    () => verify({
      currentUser: makeLocalUser(),
      invitedEmail: 'member@example.test',
    }),
    { code: 'INVITATION_VERIFIED_EMAIL_REQUIRED' }
  )
})

test('invitation identity: secondary email cannot substitute for primary email', async () => {
  const clerkUser = makeClerkUser()

  clerkUser.emailAddresses.push({
    id: 'email_secondary',
    emailAddress: 'secondary@example.test',
    verification: { status: 'verified' },
  })

  const verify = createInvitationIdentityVerifier(
    async () => clerkUser
  )

  await assert.rejects(
    () => verify({
      currentUser: makeLocalUser(),
      invitedEmail: 'secondary@example.test',
    }),
    { code: 'INVITATION_EMAIL_MISMATCH' }
  )
})

test('invitation identity: invalid local identity is rejected before provider lookup', async () => {
  let calls = 0

  const verify = createInvitationIdentityVerifier(async () => {
    calls += 1
    return makeClerkUser()
  })

  const invalidUsers = [
    null,
    {},
    { ...makeLocalUser(), active: false },
    { ...makeLocalUser(), auth_provider: 'test' },
    { ...makeLocalUser(), auth_subject: '' },
    { ...makeLocalUser(), id: null },
    { ...makeLocalUser(), id: true },
    { ...makeLocalUser(), id: 0 },
  ]

  for (const currentUser of invalidUsers) {
    await assert.rejects(
      () => verify({
        currentUser,
        invitedEmail: 'member@example.test',
      }),
      { code: 'INVITATION_AUTH_IDENTITY_REQUIRED' }
    )
  }

  assert.equal(calls, 0)
})

test('invitation identity: mismatched or unavailable provider account is rejected', async () => {
  const cases = [
    {
      changes: { id: 'another_user' },
      code: 'INVITATION_AUTH_IDENTITY_MISMATCH',
    },
    {
      changes: { banned: true },
      code: 'INVITATION_AUTH_ACCOUNT_UNAVAILABLE',
    },
    {
      changes: { locked: true },
      code: 'INVITATION_AUTH_ACCOUNT_UNAVAILABLE',
    },
  ]

  for (const item of cases) {
    const verify = createInvitationIdentityVerifier(
      async () => ({
        ...makeClerkUser(),
        ...item.changes,
      })
    )

    await assert.rejects(
      () => verify({
        currentUser: makeLocalUser(),
        invitedEmail: 'member@example.test',
      }),
      { code: item.code }
    )
  }
})

test('invitation identity: every acceptance attempt reloads provider identity', async () => {
  let calls = 0

  const verify = createInvitationIdentityVerifier(async () => {
    calls += 1

    const clerkUser = makeClerkUser()

    if (calls > 1) {
      clerkUser.emailAddresses[0].emailAddress =
        'changed@example.test'
    }

    return clerkUser
  })

  await verify({
    currentUser: makeLocalUser(),
    invitedEmail: 'member@example.test',
  })

  await assert.rejects(
    () => verify({
      currentUser: makeLocalUser(),
      invitedEmail: 'member@example.test',
    }),
    { code: 'INVITATION_EMAIL_MISMATCH' }
  )

  assert.equal(calls, 2)
})

test('invitation identity: provider failure is propagated without local-email fallback', async () => {
  const providerError = new Error('Provider unavailable')

  const verify = createInvitationIdentityVerifier(async () => {
    throw providerError
  })

  await assert.rejects(
    () => verify({
      currentUser: makeLocalUser(),
      invitedEmail: 'old-address@example.test',
    }),
    (error) => {
      assert.equal(error, providerError)
      return true
    }
  )
})