import type { ReactNode } from 'react'

type Props = {
  title: string
  /** A short line under the title. */
  description?: string
  /** Buttons for the page's main actions, shown on the right. */
  actions?: ReactNode
}

// The title block at the top of every page.
export default function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl font-semibold text-wine-800 lg:text-5xl">{title}</h1>
        {description && <p className="mt-1.5 text-taupe-700">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
