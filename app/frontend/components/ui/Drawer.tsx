import { router } from '@inertiajs/react'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  /** Small things beside the title (a "2 drafts" link...). */
  extra?: ReactNode
  children: ReactNode
}

// A panel that slides over the page: up from the bottom on a phone (drag
// the handle down, tap outside, or press Escape to put it away), in from
// the right on a computer. Used for "Record a sale", "Record a purchase"
// and "Add a supplier", so they don't take her away from the list.
//
// It stays in the page while closed (moved off screen and `inert`), so
// opening it again is instant and anything half typed is still there.
export default function Drawer({ open, onClose, title, extra, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  // How far the handle has been dragged down, in pixels (phones).
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)

  // Escape closes it; the page behind doesn't scroll while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  // The sheet follows the finger; let go far enough down (a third of the
  // way, or 140px) and it closes, otherwise it springs back.
  const onPointerDown = (event: ReactPointerEvent) => {
    start.current = event.clientY
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent) => {
    if (start.current !== null) setDrag(Math.max(0, event.clientY - start.current))
  }
  const onPointerUp = () => {
    if (start.current === null) return
    const height = panel.current?.offsetHeight ?? 600
    if (drag > Math.min(140, height / 3)) onClose()
    start.current = null
    setDrag(0)
  }

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      {/* The dimmed page behind. Tapping it closes the drawer. */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        inert={!open}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        className={`absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-2xl bg-taupe-50 shadow-2xl transition-transform duration-300 ease-out outline-none lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[min(64rem,calc(100vw-4rem))] lg:rounded-none ${
          open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full lg:translate-y-0'
        }`}
      >
        {/* Header: the drag handle (phones), the title, close. */}
        <div
          className="shrink-0 touch-none border-b border-taupe-200 px-4 pt-2 pb-3 select-none sm:px-6 lg:pt-4"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-taupe-300 lg:hidden" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <h2 className="flex-1 font-display text-2xl font-semibold text-wine-800">{title}</h2>
            {extra && <span onPointerDown={(event) => event.stopPropagation()}>{extra}</span>}
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Close"
              className="flex size-11 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* The content scrolls inside the drawer. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6 sm:px-6">{children}</div>
      </div>
    </div>
  )
}

// While a drawer's data loads (the first opening only).
export function DrawerLoading() {
  return (
    <div className="animate-pulse space-y-4 pb-8" role="status" aria-label="Loading">
      <div className="h-5 w-48 rounded bg-taupe-200" />
      <div className="h-12 rounded-md bg-taupe-200" />
      <div className="h-12 rounded-md bg-taupe-200" />
      <div className="h-40 rounded-lg bg-taupe-200" />
    </div>
  )
}

// Phones: a round + always within reach of the thumb, above the bottom bar.
export function DrawerFab({ label, onClick, hidden }: { label: string; onClick: () => void; hidden: boolean }) {
  return (
    <>
      {/* Room at the end of the page, so the + never covers the last row. */}
      <div className="h-16 lg:hidden" aria-hidden="true" />
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-wine-800 text-taupe-50 shadow-lg shadow-wine-900/30 transition-transform hover:bg-wine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 active:scale-95 lg:hidden ${
          hidden ? 'scale-0' : ''
        }`}
      >
        <Plus className="size-7" aria-hidden="true" />
      </button>
    </>
  )
}

// Ask the server for an optional prop a drawer needs (`only: [key]`).
export function loadDrawerData<T>(key: string, onLoaded: (data: T | null) => void) {
  router.reload({
    only: [key],
    onSuccess: (page) => onLoaded((page.props[key] as T | null | undefined) ?? null),
  })
}
