import { Link, router } from '@inertiajs/react'
import { FilePen, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import SaleCapture from '@/components/SaleCapture'
import type { Buyer, SellableProduct } from '@/components/SaleCapture'
import type { Locations } from '@/components/LocationFields'
import type { SalesChannel } from '@/lib/orders'

// What Record a sale needs (OrdersController#sale_props).
export type SaleData = {
  products: SellableProduct[]
  buyers: Buyer[]
  channels: SalesChannel[]
  locations: Locations
  ways_to_pay: { value: string; label: string; reference?: boolean }[] | null
}

type Props = {
  open: boolean
  onClose: () => void
  /** null until the server has sent it (the first time the drawer opens). */
  data: SaleData | null
  /** Sales saved halfway: a link to finish them on the full page. */
  drafts: number
}

// "Record a sale" without leaving the orders list. On a phone it slides up
// from the bottom (drag the handle down, or tap outside, to put it away); on
// a computer it slides in from the right.
//
// The screen inside is the same SaleCapture as the full Record a sale page.
// Recording the sale sends her back to this list (the drawer closes, the new
// order is on top); a mistake keeps the drawer open with the problem shown.
//
// The drawer stays in the page while closed (just moved off screen), so
// opening it again is instant and anything half typed is still there.
export default function SaleDrawer({ open, onClose, data, drafts }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  // How far she has dragged the handle down, in pixels (phones).
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

  // Dragging the handle: the sheet follows the finger; let go far enough
  // down (a third of the way, or 140px) and it closes, else it springs back.
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
      {/* The dimmed list behind. Tapping it closes the drawer. */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale_drawer_title"
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
            <h2 id="sale_drawer_title" className="flex-1 font-display text-2xl font-semibold text-wine-800">
              Record a sale
            </h2>
            {drafts > 0 && (
              <Link
                href="/admin/orders/new"
                onPointerDown={(event) => event.stopPropagation()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-wine-800 hover:bg-taupe-100"
              >
                <FilePen className="size-4" aria-hidden="true" />
                {drafts === 1 ? '1 draft' : `${drafts} drafts`}
              </Link>
            )}
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

        {/* The sale screen. It scrolls inside the drawer; its total bar sticks
            to the drawer's bottom. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 sm:px-6 lg:pb-6">
          {data ? (
            <SaleCapture
              inDrawer
              products={data.products}
              buyers={data.buyers}
              channels={data.channels}
              locations={data.locations}
              waysToPay={data.ways_to_pay}
            />
          ) : (
            <Loading />
          )}
        </div>
      </div>
    </div>
  )
}

// While the products and buyers load (the first opening only).
function Loading() {
  return (
    <div className="animate-pulse space-y-4 pb-8" role="status" aria-label="Loading">
      <div className="h-5 w-48 rounded bg-taupe-200" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-11 w-24 rounded-full bg-taupe-200" />
        ))}
      </div>
      <div className="h-12 rounded-md bg-taupe-200" />
      <div className="h-12 rounded-md bg-taupe-200" />
      <div className="h-40 rounded-lg bg-taupe-200" />
    </div>
  )
}

// Ask the server for what the drawer needs (the optional `sale` prop), once.
export function loadSale(onLoaded: (data: SaleData | null) => void) {
  router.reload({
    only: ['sale'],
    onSuccess: (page) => onLoaded((page.props.sale as SaleData | null | undefined) ?? null),
  })
}
