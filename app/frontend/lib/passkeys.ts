import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'

// Passkeys = logging in with Face ID, a fingerprint or the device PIN.
//
// Both flows are a short conversation with Rails:
//
//   1. ask Rails for a random "challenge"
//   2. hand it to the device, which asks for face / fingerprint and signs it
//   3. send the signed answer back to Rails, which checks it
//
// Step 2 is the browser's own WebAuthn feature; the @simplewebauthn/browser
// package wraps it so we don't deal with raw bytes.

export const passkeysSupported = () => browserSupportsWebAuthn()

// This is the one place the app talks to Rails with plain fetch() instead of
// Inertia, because the device has to do something between two requests.
async function post<T>(url: string, body: unknown = {}): Promise<T> {
  // Rails rejects POSTs without this token (protection against forged
  // requests). Inertia adds it for us elsewhere; here we add it by hand.
  const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
  return data as T
}

// Turns the browser's technical errors into something she can act on.
function friendly(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') return 'Cancelled. Nothing was changed.'
    if (error.name === 'InvalidStateError') return 'This device already has a passkey for your account.'
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

/** Register this device for the logged-in person. Resolves to an error message, or null on success. */
export async function registerPasskey(name: string): Promise<string | null> {
  try {
    const optionsJSON = await post<Parameters<typeof startRegistration>[0]['optionsJSON']>(
      '/account/passkeys/challenge',
    )
    const credential = await startRegistration({ optionsJSON }) // Face ID / fingerprint prompt
    await post('/account/passkeys', { credential, name })
    return null
  } catch (error) {
    return friendly(error)
  }
}

/** Log in with a passkey. Resolves to where to go next, or an error message. */
export async function loginWithPasskey(): Promise<{ redirectTo: string } | { error: string }> {
  try {
    const optionsJSON = await post<Parameters<typeof startAuthentication>[0]['optionsJSON']>(
      '/session/passkey/challenge',
    )
    const credential = await startAuthentication({ optionsJSON }) // Face ID / fingerprint prompt
    const result = await post<{ redirect_to: string }>('/session/passkey', { credential })
    return { redirectTo: result.redirect_to }
  } catch (error) {
    return { error: friendly(error) }
  }
}

/** A sensible default name for this device, which she can change. */
export function guessDeviceName(userAgent = navigator.userAgent): string {
  if (/iPhone/.test(userAgent)) return 'iPhone'
  if (/iPad/.test(userAgent)) return 'iPad'
  if (/Android/.test(userAgent)) return 'Android phone'
  if (/Macintosh/.test(userAgent)) return 'Mac'
  if (/Windows/.test(userAgent)) return 'Windows PC'
  return 'This device'
}
