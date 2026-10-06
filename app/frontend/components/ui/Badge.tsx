import type { ReactNode } from 'react'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'muted'

const tones: Record<Tone, string> = {
  neutral: 'bg-taupe-100 text-taupe-800',
  brand: 'bg-wine-800 text-taupe-50',
  success: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-900',
  muted: 'bg-taupe-100 text-taupe-600',
}

// A small label for a status or category.
export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}
