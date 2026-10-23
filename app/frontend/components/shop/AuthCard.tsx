import type { ReactNode } from 'react'

// The frame for the shop's small account pages (log in, sign up, reset):
// a heading, a line under it, and the form in a card.
export default function AuthCard({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto mt-10 max-w-md">
      <h1 className="text-center font-display text-4xl font-semibold text-wine-800 sm:text-5xl">{title}</h1>
      {lead && <p className="mt-3 text-center text-taupe-800">{lead}</p>}
      <div className="mt-8 rounded-xl border border-taupe-200 bg-white p-5 sm:p-6">{children}</div>
    </div>
  )
}
