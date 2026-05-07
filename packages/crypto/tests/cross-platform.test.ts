import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encryptWithNonce } from '../src/encrypt'
import { deriveVaultKey } from '../src/kdf'
import { fromBase64, fromHex, toHex } from '../src/encoding'
import type { KdfParams } from '../src/kdf-params'

type AeadFixture = {
  name: string
  key_hex: string
  nonce_hex: string
  ad: string
  plaintext_hex: string
  expected_ciphertext_hex: string
}

type KdfFixture = {
  name: string
  password: string
  salt_hex: string
  memlimit: number
  opslimit: number
  out_len: number
  expected_key_hex: string
}

type Fixture = { kdf: KdfFixture[]; aead: AeadFixture[] }

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(here, 'fixtures', 'cross-platform.json'), 'utf-8'),
) as Fixture

describe('cross-platform fixtures (JS arm)', () => {
  for (const f of fixture.aead) {
    it(`AEAD: ${f.name}`, async () => {
      if (f.expected_ciphertext_hex.startsWith('PLACEHOLDER')) {
        return // fixture not generated yet — Rust parity will fail until populated
      }
      const key = await fromHex(f.key_hex)
      const nonce = await fromHex(f.nonce_hex)
      const plaintext = await fromHex(f.plaintext_hex)
      const env = await encryptWithNonce(plaintext, key, f.ad, nonce)
      const ctBytes = await fromBase64(env.ct)
      expect(await toHex(ctBytes)).toBe(f.expected_ciphertext_hex)
    })
  }

  for (const f of fixture.kdf) {
    it(`KDF: ${f.name}`, async () => {
      if (f.expected_key_hex.startsWith('PLACEHOLDER')) {
        return
      }
      const params: KdfParams = {
        version: 1,
        alg: 'argon2id',
        memlimit: f.memlimit,
        opslimit: f.opslimit,
        salt_len: f.salt_hex.length / 2,
        out_len: f.out_len,
      }
      const salt = await fromHex(f.salt_hex)
      const key = await deriveVaultKey(f.password, salt, params)
      expect(await toHex(key)).toBe(f.expected_key_hex)
    }, 30_000)
  }
})
