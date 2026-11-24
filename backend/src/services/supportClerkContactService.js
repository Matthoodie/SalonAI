import { deliveryEmail } from '../utils/supportDelivery.js'

// Current primary email only. Never fall back to users.email or user metadata.
export function createSupportClerkContactResolver({ getUser, timeoutMs = 10000 } = {}) {
  if (typeof getUser !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) {
    throw new Error('Invalid contact resolver configuration.')
  }
  return async subject => {
    if (typeof subject !== 'string' || !/^user_[A-Za-z0-9]+$/.test(subject)) return null
    let timer
    try {
      const user = await Promise.race([
        Promise.resolve().then(() => getUser(subject)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error()), timeoutMs) }),
      ])
      if (!user || user.id !== subject || user.banned !== false || user.locked !== false ||
          user.deleted === true || user.deprovisioned === true || !user.primaryEmailAddressId ||
          !Array.isArray(user.emailAddresses)) return null
      const matches = user.emailAddresses.filter(item => item.id === user.primaryEmailAddressId)
      if (matches.length !== 1) return null
      const primary = matches[0]
      if (primary.verification?.status !== 'verified' || !deliveryEmail(primary.emailAddress)) return null
      return { subject, email: primary.emailAddress, verified: true }
    } catch {
      // No provider error bodies, keys, account details or addresses in errors.
      throw new Error('Clerk contact verification unavailable; no delivery was started.')
    } finally { clearTimeout(timer) }
  }
}
