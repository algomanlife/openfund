import { createVerifier } from './password.js'

const chunks = []
for await (const chunk of process.stdin) {
  chunks.push(chunk)
  if (chunks.reduce((size, part) => size + part.length, 0) > 258) throw new Error('Password input is too long')
}
console.log(await createVerifier(Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')))
