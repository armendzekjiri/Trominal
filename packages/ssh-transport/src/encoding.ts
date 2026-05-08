const textEncoder = new TextEncoder()

export function utf8(value: string): Uint8Array {
  return textEncoder.encode(value)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
