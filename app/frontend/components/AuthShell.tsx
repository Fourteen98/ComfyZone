import type { ReactNode } from 'react'
import logoWall from '@/assets/brand/logo-wall.jpg'

// The frame around every page seen BEFORE logging in: log in, forgot
// password, choose a new password. The brand photo on one side, the form
// (passed in as children) on the other.
//
// Phone: the logo on top, the form below.
// Desktop (lg and up): logo on the left, form on the right.
export default function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* The logo photo is the whole panel; the background colour underneath
          matches the wall so nothing flashes while it loads. */}
      <div className="h-[42dvh] shrink-0 bg-taupe-500 lg:h-auto lg:w-[55%]">
        <img src={logoWall} alt="The Comfy Zone by Fazy. Comfort meets style." className="size-full object-cover object-[center_45%]" />
      </div>

      <main className="flex flex-1 items-start justify-center px-6 py-10 lg:items-center lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-4xl font-semibold text-wine-800 lg:text-5xl">{title}</h1>
          <p className="mt-2 text-taupe-700">{lead}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
