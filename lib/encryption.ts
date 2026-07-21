/**
 * Per-file end-to-end encryption. The passphrase never leaves the browser —
 * the server only ever sees ciphertext plus a random IV/salt, so it cannot
 * decrypt the file and neither can we if the passphrase is lost.
 *
 * Size limit: WebCrypto's AES-GCM is one-shot, holding plaintext and
 * ciphertext in memory simultaneously, so files above `MAX_ENCRYPT_SIZE` are
 * refused rather than crashing the tab.
 */

import { MAX_ENCRYPT_SIZE } from '@/lib/constants'
import { formatBytes } from '@/lib/file-utils'

const PBKDF2_ITERATIONS = 150_000

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encryptBlob(
  blob: Blob,
  passphrase: string,
): Promise<{ ciphertext: Blob; iv: string; salt: string }> {
  if (blob.size > MAX_ENCRYPT_SIZE) {
    throw new Error(
      `Encrypted uploads are limited to ${formatBytes(MAX_ENCRYPT_SIZE)}. Upload this file without encryption.`,
    )
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plaintext = await blob.arrayBuffer()
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext)

  return {
    ciphertext: new Blob([encrypted], { type: 'application/octet-stream' }),
    iv: toBase64(iv),
    salt: toBase64(salt),
  }
}

/** Throws a plain `Error('Incorrect passphrase.')` if the passphrase is wrong. */
export async function decryptBlob(
  blob: Blob,
  passphrase: string,
  ivBase64: string,
  saltBase64: string,
  mimeType: string,
): Promise<Blob> {
  const salt = fromBase64(saltBase64)
  const iv = fromBase64(ivBase64)
  const key = await deriveKey(passphrase, salt)
  const ciphertext = await blob.arrayBuffer()

  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext)
    return new Blob([decrypted], { type: mimeType || 'application/octet-stream' })
  } catch {
    throw new Error('Incorrect passphrase.')
  }
}
