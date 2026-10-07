import { useEffect, useState } from 'react'

// Chrome and Android fire `beforeinstallprompt` when the site qualifies to
// be installed, usually moments after the page loads and well before any
// button exists to react to it. So the event is caught here, the moment
// this file is first imported, and kept for later.
//
// (TypeScript has no built-in type for this event yet, hence the small one.)
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let saved: InstallEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // stop the browser's own mini-banner; we offer a button
    saved = event as InstallEvent
    listeners.forEach((notify) => notify())
  })
  window.addEventListener('appinstalled', () => {
    saved = null
    listeners.forEach((notify) => notify())
  })
}

// What the Account page needs to know to offer "Install".
//   installed  already running from the home screen
//   canPrompt  the browser will show its install dialog if asked (Android, Chrome)
//   ios        iPhone/iPad: there is no dialog, only Share > Add to Home Screen
export function useInstall() {
  const [, refresh] = useState(0)

  useEffect(() => {
    const notify = () => refresh((n) => n + 1)
    listeners.add(notify)
    return () => {
      listeners.delete(notify)
    }
  }, [])

  const installed =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  return {
    installed,
    canPrompt: saved !== null,
    ios,
    async install() {
      if (!saved) return
      await saved.prompt()
      await saved.userChoice
      saved = null
      refresh((n) => n + 1)
    },
  }
}
