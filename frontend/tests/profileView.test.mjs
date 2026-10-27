import test from 'node:test'
import assert from 'node:assert/strict'
import { profileView, roleLabel } from '../src/components/Profile/profileView.js'

test('profile: current Clerk name takes precedence over saved backend name', () => {
 const profile = profileView({ firstName: ' Ana ', lastName: ' Kovač ', primaryEmailAddress: { emailAddress: 'ana@example.test' } }, { display_name: 'Old name' })
 assert.equal(profile.name, 'Ana Kovač')
 assert.equal(profile.email, 'ana@example.test')
 assert.equal(profile.initials, 'AK')
})
test('profile: removing Clerk name does not resurrect stale backend name', () => {
 assert.equal(profileView({ primaryEmailAddress: { emailAddress: 'ana@example.test' } }, { display_name: 'Old name' }).name, 'ana@example.test')
})
test('profile: username is available when first and last names are absent', () => {
 assert.equal(profileView({ username: 'ana' }, { display_name: 'Old name' }).name, 'ana')
})
test('profile: backend identity is fallback while Clerk data is unavailable', () => {
 assert.equal(profileView(null, { display_name: 'Ana Kovač', email: 'ana@example.test' }).name, 'Ana Kovač')
})
test('profile: missing identities produce a neutral label', () => {
 assert.deepEqual(profileView(null, null), { name: 'Korisnik', email: '', initials: 'KO', imageUrl: null })
})
test('profile: Croatian initials preserve characters and compound names', () => {
 assert.equal(profileView({ firstName: 'Željka', lastName: 'Šimić Novak' }).initials, 'ŽN')
})
test('profile: email fallback produces initials without displaying a fabricated name', () => {
 const p = profileView({ primaryEmailAddress: { emailAddress: 'ana@example.test' } })
 assert.equal(p.name, 'ana@example.test'); assert.equal(p.initials, 'AN')
})
test('profile: uploaded HTTPS avatar is accepted', () => {
 assert.equal(profileView({ hasImage: true, imageUrl: 'https://example.test/avatar.jpg' }).imageUrl, 'https://example.test/avatar.jpg')
})
test('profile: default image and unsafe URL schemes fall back to initials', () => {
 assert.equal(profileView({ hasImage: false, imageUrl: 'https://example.test/avatar.jpg' }).imageUrl, null)
 for (const imageUrl of ['javascript:alert(1)', 'data:image/png;base64,abc', 'http://example.test/a.jpg', '']) {
  assert.equal(profileView({ hasImage: true, imageUrl }).imageUrl, null)
 }
})
test('profile: role labels only reflect recognized backend roles', () => {
 assert.equal(roleLabel('owner'), 'Vlasnik')
 assert.equal(roleLabel('admin'), 'Administrator')
 assert.equal(roleLabel('employee'), 'Zaposlenik')
 assert.equal(roleLabel(undefined), '')
 assert.equal(roleLabel('superadmin'), '')
})
