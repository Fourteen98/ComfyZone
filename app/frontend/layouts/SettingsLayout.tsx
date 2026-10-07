import { Link, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'
import AppLayout from '@/layouts/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { useCan } from '@/lib/permissions'

// The sections inside Settings. More get added here as they are built
// (payment methods, delivery zones...).
const tabs = [
  { label: 'Options', href: '/admin/settings/options', permission: 'settings.manage' },
  { label: 'Categories', href: '/admin/settings/categories', permission: 'settings.manage' },
  { label: 'Sales channels', href: '/admin/settings/channels', permission: 'settings.manage' },
  { label: 'Locations', href: '/admin/settings/areas', permission: 'settings.manage' },
  { label: 'Payment methods', href: '/admin/settings/payments', permission: 'settings.manage' },
  { label: 'Team', href: '/admin/settings/users', permission: 'users.manage' },
  { label: 'Roles', href: '/admin/settings/roles', permission: 'roles.manage' },
]

// A layout inside a layout: the app frame, then the Settings title and tabs,
// then the page.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { url } = usePage()
  const can = useCan()

  return (
    <AppLayout>
      <PageHeader title="Settings" />

      <nav aria-label="Settings" className="mt-5 flex gap-1 overflow-x-auto border-b border-taupe-200">
        {tabs
          .filter((tab) => can(tab.permission))
          .map((tab) => {
            const active = url.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px flex min-h-11 shrink-0 items-center border-b-2 px-4 font-medium ${
                  active
                    ? 'border-wine-800 text-wine-800'
                    : 'border-transparent text-taupe-700 hover:border-taupe-300 hover:text-wine-800'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
      </nav>

      <div className="mt-6">{children}</div>
    </AppLayout>
  )
}
