import { useCallback, useEffect, useState } from 'react'
import { guessDeviceName } from '@/lib/passkeys'

// Push notifications, the browser's half. (Rails' half is app/models/push.rb,
// which has the whole story of how a notification travels.)
//
// Turning them on is three steps, all here in `turnOn`:
//   1. ask permission (the browser's own "Allow notifications?" box)
//   2. ask the browser to subscribe this device with the push service
//   3. post the address it gives back to Rails, which saves it
//
// What the Account page can be told about this device:
//   'checking'     still finding out
//   'unsupported'  this browser can't do it (or the service worker isn't running)
//   'needs-install' an iPhone that hasn't added the app to its home screen;
//                   Apple only allows notifications from installed web apps
//   'blocked'      she said "Block" before; only the phone's settings can undo it
//   'off' | 'on'
export type PushState = 'checking' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

// The public key arrives as text; the browser wants raw bytes.
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function send(method: 'POST', url: string, body: unknown): Promise<void> {
  const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? 'Could not save. Please try again.')
  }
}

// The service worker registration, or null if there isn't one (development,
// or a browser without service workers). Deliberately not `serviceWorker.ready`,
// which waits for ever when no worker is coming.
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export function usePush(publicKey: string) {
  const [state, setState] = useState<PushState>('checking')
  // This device's address at the push service, when it has one. The Account
  // page matches it against the saved rows to mark "this device".
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const installed =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

    const worker = await registration()
    if (!worker) return setState(ios && !installed ? 'needs-install' : 'unsupported')
    if (Notification.permission === 'denied') return setState('blocked')

    const existing = await worker.pushManager.getSubscription()
    setEndpoint(existing?.endpoint ?? null)
    setState(existing ? 'on' : 'off')
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  /** Resolves to true once this device is subscribed and saved. */
  async function turnOn(): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const worker = await registration()
      if (!worker) throw new Error("This browser can't show notifications.")

      // Must be called from a tap: browsers refuse to ask out of the blue.
      if ((await Notification.requestPermission()) !== 'granted') {
        setState(Notification.permission === 'denied' ? 'blocked' : 'off')
        return false
      }

      const subscription =
        (await worker.pushManager.getSubscription()) ??
        (await worker.pushManager.subscribe({
          userVisibleOnly: true, // every push shows a notification; browsers require this promise
          applicationServerKey: keyBytes(publicKey),
        }))

      // toJSON() gives { endpoint, keys: { p256dh, auth } }: exactly what Rails saves.
      await send('POST', '/admin/account/push_subscriptions', { ...subscription.toJSON(), device: guessDeviceName() })
      setEndpoint(subscription.endpoint)
      setState('on')
      return true
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Stop this device receiving, on the browser's side. Rails' row is removed separately. */
  async function turnOff(): Promise<void> {
    const worker = await registration()
    const subscription = await worker?.pushManager.getSubscription()
    await subscription?.unsubscribe()
    setEndpoint(null)
    setState('off')
  }

  return { state, endpoint, error, busy, turnOn, turnOff }
}
