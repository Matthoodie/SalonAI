import {
  randomBytes,
  createHash,
} from 'node:crypto'

export function hashInvitationToken(token) {
  if (
    typeof token !== 'string' ||
    !/^[0-9a-f]{64}$/.test(token)
  ) {
    const error = new Error(
      'The invitation token is invalid.'
    )

    error.code = 'INVALID_INVITATION_TOKEN'
    error.statusCode = 400

    throw error
  }

  return createHash('sha256')
    .update(token, 'utf8')
    .digest('hex')
}

export function createInvitationToken() {
  const token = randomBytes(32).toString('hex')

  return {
    token,
    tokenHash: hashInvitationToken(token),
  }
}