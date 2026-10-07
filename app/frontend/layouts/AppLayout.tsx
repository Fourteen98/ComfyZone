import { Link, usePage } from '@inertiajs/react'
import { CircleUserRound, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Alert from '@/components/ui/Alert'
import { navigation } from '@/lib/navigation'
import type { NavItem } from '@/lib/navigation'
import { useCan } from '@/lib/permissions'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// The frame around every logged-in page.
//
//   Desktop (lg and up):  fixed sidebar on the left, content fills the rest.
//   Phone:                slim top bar, content, and a bottom bar for thumbs.
//                         The bottom bar holds four sections plus "More",
//                         which opens a sheet with everything else.
export default function AppLayout({ children }: { children: ReactNode }) {
  // usePage() is how any component reaches the data Rails sent.
  // `props.auth` comes from inertia_share; `flash` from Rails' flash;
  // `url` is the current path, used to highlight the active section.
  const { props, flash, url } = usePage()
  const user = props.auth.user
  const [moreOpen, setMoreOpen] = useState(false)

  // Only show sections this person is allowed to open.
  const can = useCan()
  const items = navigation.filter((item) => !item.permissions || item.permissions.some(can))

  const isActive = (item: NavItem) => (item.href === '/' ? url === '/' : url.startsWith(item.href))
  const onAccount = url.startsWith('/account')

  // Phone: four in the bar, the rest under "More".
  const barItems = items.filter((item) => item.mobile).slice(0, 4)
  const moreItems = items.filter((item) => !barItems.includes(item))
  const moreIsActive = moreItems.some(isActive) || onAccount

  // Close the sheet whenever she lands on a new page.
  useEffect(() => setMoreOpen(false), [url])

  return (
    <div className="min-h-dvh">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-wine-800 text-taupe-200 lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 py-6">
          <img src="/icon.png" alt="" className="size-11 rounded-md" />
          <span className="font-display text-2xl leading-none font-semibold text-taupe-50">
            The Comfy Zone
            <span className="mt-1 block font-sans text-xs font-normal tracking-wide text-taupe-400">by Fazy</span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item)} />
          ))}
        </nav>

        {user && (
          <div className="border-t border-wine-700 p-3">
            {/* Your name links to "My account" (passkeys live there). */}
            <Link
              href="/account"
              aria-current={onAccount ? 'page' : undefined}
              className={`mb-1 flex min-h-11 items-center gap-3 rounded-md px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-taupe-200 ${
                onAccount ? 'bg-taupe-50 text-wine-800' : 'hover:bg-wine-700'
              }`}
            >
              <CircleUserRound className="size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className={`block truncate font-medium ${onAccount ? '' : 'text-taupe-50'}`}>{user.name}</span>
                <span className="block truncate text-sm opacity-70">{user.role}</span>
              </span>
            </Link>
            {/* A Link with method="delete" sends DELETE /session, which
                Rails routes to SessionsController#destroy. */}
            <Link
              href="/session"
              method="delete"
              as="button"
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-taupe-200 hover:bg-wine-700 hover:text-taupe-50 focus-visible:outline-2 focus-visible:outline-taupe-200"
            >
              <LogOut className="size-5" aria-hidden="true" />
              Log out
            </Link>
          </div>
        )}
      </aside>

      {/* ---------- Phone top bar ---------- */}
      <header className="sticky top-0 z-10 flex items-center border-b border-taupe-200 bg-taupe-50/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/icon.png" alt="" className="size-9 rounded-md" />
          <span className="font-display text-xl font-semibold text-wine-800">The Comfy Zone</span>
        </Link>
      </header>

      {/* ---------- Page content ----------
          lg:pl-74 leaves room for the sidebar; pb-24 leaves room for the
          phone bottom bar. The content uses the full remaining width, up to
          a comfortable maximum on very large screens. */}
      <main className="px-4 pt-6 pb-24 sm:px-6 lg:pt-10 lg:pr-10 lg:pb-12 lg:pl-74">
        <div className="mx-auto max-w-[96rem]">
          {(flash.notice || flash.alert) && (
            <div className="mb-6 space-y-2">
              {flash.notice && <Alert tone="success">{flash.notice}</Alert>}
              {flash.alert && <Alert tone="error">{flash.alert}</Alert>}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* The one "are you sure?" dialog, opened with confirmAction(). */}
      <ConfirmDialog />

      {/* ---------- Phone "More" sheet ----------
          Slides up from the bottom bar with every section that doesn't fit
          in it, plus her account and Log out. */}
      {moreOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          {/* The dimmed backdrop; tapping it closes the sheet. */}
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/50" onClick={() => setMoreOpen(false)} />

          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+4.5rem)] shadow-[0_-8px_30px_rgb(42_31_29/0.25)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="font-display text-2xl font-semibold text-wine-800">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="flex size-11 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="More sections" className="px-3">
              {moreItems.map((item) => (
                <SheetLink key={item.href} item={item} active={isActive(item)} />
              ))}
            </nav>

            {user && (
              <div className="mx-3 mt-2 border-t border-taupe-200 pt-2">
                <Link
                  href="/account"
                  aria-current={onAccount ? 'page' : undefined}
                  className={`flex min-h-14 items-center gap-3.5 rounded-md px-3 ${onAccount ? 'bg-taupe-100 text-wine-800' : ''}`}
                >
                  <CircleUserRound className="size-6 text-wine-800" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block truncate text-sm text-taupe-700">{user.role}, my account</span>
                  </span>
                </Link>
                <Link href="/session" method="delete" as="button" className="flex min-h-14 w-full items-center gap-3.5 rounded-md px-3 text-left">
                  <LogOut className="size-6 text-wine-800" aria-hidden="true" />
                  Log out
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Phone bottom bar ---------- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-taupe-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {barItems.map((item) => (
          <BottomBarLink key={item.href} item={item} active={isActive(item) && !moreOpen} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          aria-expanded={moreOpen}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
            moreOpen || moreIsActive ? 'font-medium text-wine-800' : 'text-taupe-700'
          }`}
        >
          <Menu className="size-5" aria-hidden="true" />
          More
        </button>
      </nav>
    </div>
  )
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  const base = 'flex min-h-11 items-center gap-3 rounded-md px-3'

  // Sections that aren't built yet are visible but not clickable.
  if (!item.ready) {
    return (
      <span className={`${base} cursor-default text-taupe-200/45`} aria-disabled="true">
        <Icon className="size-5" aria-hidden="true" />
        {item.label}
        <span className="ml-auto text-xs">Soon</span>
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`${base} focus-visible:outline-2 focus-visible:outline-taupe-200 ${
        active ? 'bg-taupe-50 font-medium text-wine-800' : 'hover:bg-wine-700 hover:text-taupe-50'
      }`}
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.label}
    </Link>
  )
}

function SheetLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  const base = 'flex min-h-14 items-center gap-3.5 rounded-md px-3'

  if (!item.ready) {
    return (
      <span className={`${base} text-taupe-400`} aria-disabled="true">
        <Icon className="size-6" aria-hidden="true" />
        {item.label}
        <span className="ml-auto text-sm">Soon</span>
      </span>
    )
  }

  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={`${base} ${active ? 'bg-taupe-100 font-medium text-wine-800' : ''}`}>
      <Icon className="size-6 text-wine-800" aria-hidden="true" />
      {item.label}
    </Link>
  )
}

function BottomBarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  const base = 'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs'

  if (!item.ready) {
    return (
      <span className={`${base} text-taupe-400`} aria-disabled="true">
        <Icon className="size-5" aria-hidden="true" />
        {item.label}
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`${base} ${active ? 'font-medium text-wine-800' : 'text-taupe-700'}`}
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.label}
    </Link>
  )
}
