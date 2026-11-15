import { promisify } from 'node:util'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const derive = promisify(scrypt)
const options = { N: 65536, r: 8, p: 1, maxmem: 96 * 1024 * 1024 }
export const validVerifier = value => typeof value === 'string' && /^[a-f0-9]{32}:[a-f0-9]{64}$/.test(value)
const validPassword = password => typeof password === 'string' && password.length >= 16 && Buffer.byteLength(password) <= 256
export async function createVerifier(password) {
  if (!validPassword(password)) throw new Error('Password must be at least 16 characters and no more than 256 bytes')
  const salt = randomBytes(16)
  return salt.toString('hex') + ':' + (await derive(password, salt, 32, options)).toString('hex')
}
export async function verifyPassword(password, verifier) {
  if (!validPassword(password)) return false
  const [salt, digest] = verifier.split(':').map(part => Buffer.from(part, 'hex'))
  return timingSafeEqual(await derive(password, salt, 32, options), digest)
}
