import { Link, usePage } from '@inertiajs/react'
import { ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import logoMark from '@/assets/brand/logo-wall.jpg'

// The frame around every public shop page: the header with the bag, a
// place for messages, and the footer. (The back office has its own frame,
// AppLayout; the two share colours and type but nothing else.)
export default function ShopLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { props, flash } = usePage()
  const count = props.shop?.cart_count ?? 0

  // A flash message shows as a small toast and fades by itself.
  const message = flash.alert ?? flash.notice
  const [toast, setToast] = useState<string | undefined>(message)
  useEffect(() => {
    setToast(message)
    if (!message) return
    const timer = setTimeout(() => setToast(undefined), 4000)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <div className="flex min-h-dvh flex-col bg-taupe-50 text-ink">
      <header className="sticky top-0 z-30 border-b border-taupe-200 bg-taupe-50/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <img src={logoMark} alt="" className="size-10 shrink-0 rounded-full object-cover object-[center_38%]" />
            <span className="min-w-0 leading-none">
              <span className="block truncate font-display text-2xl font-semibold text-wine-800">The Comfy Zone</span>
              <span className="block text-[0.7rem] tracking-[0.28em] text-taupe-600 uppercase">by Fazy</span>
            </span>
          </Link>

          <Link
            href="/cart"
            aria-label={count === 0 ? 'Your bag, empty' : `Your bag, ${count} ${count === 1 ? 'item' : 'items'}`}
            className="relative flex size-12 items-center justify-center rounded-full text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
          >
            <ShoppingBag className="size-6" aria-hidden="true" />
            {count > 0 && (
              <span className="absolute top-1 right-0.5 flex min-w-5 items-center justify-center rounded-full bg-wine-800 px-1 text-xs font-semibold text-white tabular-nums">
                {count}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</main>

      <footer className="mt-16 border-t border-taupe-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-8 text-sm text-taupe-700 sm:px-6">
          <p>
            <span className="font-display text-lg text-wine-800">The Comfy Zone by Fazy.</span> Comfort meets style.
          </p>
          {props.shop?.staff && (
            <Link href="/admin" className="underline underline-offset-4 hover:text-wine-800">
              Back office
            </Link>
          )}
        </div>
      </footer>

      {/* role="status" makes screen readers announce it without stealing focus. */}
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        {toast && (
          <p
            className={`pointer-events-auto rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg ${
              flash.alert ? 'bg-red-800' : 'bg-wine-800'
            }`}
          >
            {toast}
          </p>
        )}
      </div>
    </div>
  )
}
