import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createInvitationToken,
  hashInvitationToken,
} from '../src/services/invitationTokenService.js'

test('invitation token: generates separate random token and hash', () => {
  const first = createInvitationToken()
  const second = createInvitationToken()

  assert.match(first.token, /^[0-9a-f]{64}$/)
  assert.match(first.tokenHash, /^[0-9a-f]{64}$/)

  assert.notEqual(first.token, first.tokenHash)
  assert.notEqual(first.token, second.token)

  assert.equal(
    hashInvitationToken(first.token),
    first.tokenHash
  )
})

test('invitation token: hashes a known input consistently', () => {
  assert.equal(
    hashInvitationToken('a'.repeat(64)),
    'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'
  )
})

test('invitation token: rejects malformed tokens', () => {
  for (const token of [
    null,
    undefined,
    '',
    123,
    [],
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(64),
    'g'.repeat(64),
    ` ${'a'.repeat(64)}`,
  ]) {
    assert.throws(
      () => hashInvitationToken(token),
      {
        code: 'INVALID_INVITATION_TOKEN',
        statusCode: 400,
      }
    )
  }
})