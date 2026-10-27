const clean = (value) => typeof value === 'string' ? value.trim() : ''

// Clerk supplies presentation only. Salon permissions always come from the API.
export function profileView(clerkUser, currentUser) {
  const email = clean(clerkUser?.primaryEmailAddress?.emailAddress) || clean(currentUser?.email)
  const fullName = [clean(clerkUser?.firstName), clean(clerkUser?.lastName)].filter(Boolean).join(' ')
  const name = (clerkUser
    ? fullName || clean(clerkUser.username)
    : clean(currentUser?.display_name)) || email || 'Korisnik'
  const words = name === email ? [email.split('@')[0]] : name.split(/\s+/)
  const initials = (words.length > 1
    ? `${Array.from(words[0])[0] || ''}${Array.from(words.at(-1))[0] || ''}`
    : Array.from(words[0] || 'K').slice(0, 2).join('')).toLocaleUpperCase('hr-HR')
  const url = clean(clerkUser?.imageUrl)
  return { name, email, initials, imageUrl: clerkUser?.hasImage && /^https:\/\//i.test(url) ? url : null }
}

export function roleLabel(role) {
  return { owner: 'Vlasnik', admin: 'Administrator', employee: 'Zaposlenik' }[role] || ''
}
