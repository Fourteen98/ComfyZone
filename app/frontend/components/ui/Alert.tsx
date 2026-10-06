import type { ReactNode } from 'react'

type Tone = 'success' | 'error'

const tones: Record<Tone, string> = {
  success: 'border-emerald-700 bg-emerald-50 text-emerald-900',
  error: 'border-red-700 bg-red-50 text-red-900',
}

// A one-line message, used for Rails flash notices and alerts.
export default function Alert({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`border-l-2 px-3.5 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </p>
  )
}
