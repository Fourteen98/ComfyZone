import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Optional link or button on the right of the title. */
  action?: ReactNode
  children: ReactNode
  className?: string
}

// A titled white surface. The building block for dashboard widgets and
// for sections on detail pages.
export default function Panel({ title, action, children, className = '' }: Props) {
  return (
    <section className={`rounded-lg border border-taupe-200 bg-white ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-taupe-200 px-5 py-3.5">
        <h2 className="font-display text-2xl font-semibold text-wine-800">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}
