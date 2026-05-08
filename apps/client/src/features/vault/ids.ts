const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeBase32(value: bigint, length: number): string {
  let output = ''
  let current = value
  for (let i = 0; i < length; i += 1) {
    output = CROCKFORD[Number(current & 31n)] + output
    current >>= 5n
  }
  return output
}

function randomBigInt(bytes: number): bigint {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return buffer.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n)
}

/** Generate a client-side ULID so encrypted vault AD can bind to the row ID. */
export function newVaultId(nowMs = Date.now()): string {
  return encodeBase32(BigInt(nowMs), 10) + encodeBase32(randomBigInt(10), 16)
}
