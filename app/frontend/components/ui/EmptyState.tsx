import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  icon: LucideIcon
  title: string
  /** What will appear here, or what to do to fill it. */
  children?: ReactNode
}

// Shown wherever a list has nothing in it yet. Says what belongs here
// instead of leaving a blank box.
export default function EmptyState({ icon: Icon, title, children }: Props) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-taupe-100 text-wine-700">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-taupe-700">{children}</p>}
    </div>
  )
}
