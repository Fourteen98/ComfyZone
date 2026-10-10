import { Head, Link, router } from '@inertiajs/react'
import { Plus, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { formatMoney } from '@/lib/format'
import { formatPhone } from '@/lib/phone'

type CustomerRow = {
  id: number
  display_name: string
  handle: string | null
  phone: string | null
  location: string | null
  orders_count: number
  spent_pesewas: number
  last_order: string | null // "3 days ago"
}

type Props = {
  customers: CustomerRow[]
  filters: { q: string; show: 'all' | 'quiet' }
  /** Good customers who haven't bought in 30 days (CustomerInsights.gone_quiet). */
  quiet_count: number
  total: number
  can_manage: boolean
}

// Props from CustomersController#index
export default function CustomersIndex({ customers, filters, quiet_count, total, can_manage }: Props) {
  const [query, setQuery] = useState(filters.q)

  // Search as she types, after a short pause. See Products/Index for notes.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      router.get(
        '/admin/customers',
        { q: query || undefined, show: filters.show === 'quiet' ? 'quiet' : undefined },
        { preserveState: true, replace: true },
      )
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <AppLayout>
      <Head title="Customers" />

      <PageHeader
        title="Customers"
        description="Everyone who has bought from you. New buyers are added automatically when they claim something."
        actions={
          can_manage && (
            <ButtonLink href="/admin/customers/new">
              <Plus className="size-5" aria-hidden="true" />
              Add a customer
            </ButtonLink>
          )
        }
      />

      {total === 0 ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Users} title="No customers yet">
            They will appear here the first time someone claims something on a live.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* "Gone quiet": her best customers who haven't bought in a month,
              biggest spenders first. The list to win back. */}
          <nav aria-label="Show" className="mt-5 flex gap-1 border-b border-taupe-200">
            {[
              { key: 'all', label: 'Everyone', count: total, href: '/admin/customers' },
              { key: 'quiet', label: 'Gone quiet', count: quiet_count, href: '/admin/customers?show=quiet' },
            ].map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={filters.show === tab.key ? 'page' : undefined}
                className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 font-medium ${
                  filters.show === tab.key ? 'border-wine-800 text-wine-800' : 'border-transparent text-taupe-700 hover:text-wine-800'
                }`}
              >
                {tab.label}
                <span className="text-sm font-normal tabular-nums opacity-70">{tab.count}</span>
              </Link>
            ))}
          </nav>
          {filters.show === 'quiet' && (
            <p className="mt-3 max-w-2xl text-sm text-taupe-700">
              Customers who have bought before but not in the last 30 days, biggest spenders first. A message about something new in their
              size is a good way back.
            </p>
          )}

          <div className="relative mt-5 max-w-md">
            <Search className="pointer-events-none absolute top-3 left-3 size-5 text-taupe-500" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search customers"
              placeholder="Search by name, username or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block min-h-11 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
            />
          </div>

          {customers.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">
              {filters.q ? `No customer matches "${filters.q}".` : 'Nobody has gone quiet. Everyone who buys has bought in the last month.'}
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
              {customers.map((customer) => {
                const body = (
                  <>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-medium">{customer.display_name}</p>
                      <p className="truncate text-sm text-taupe-700 tabular-nums">
                        {[
                          customer.handle && customer.display_name !== `@${customer.handle}` ? `@${customer.handle}` : null,
                          formatPhone(customer.phone),
                          customer.location,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'No details yet'}
                      </p>
                    </div>
                    <p className="text-sm text-taupe-700 tabular-nums">
                      {customer.orders_count === 1 ? '1 order' : `${customer.orders_count} orders`}
                      {customer.last_order && `, last ${customer.last_order}`}
                    </p>
                    <p className="w-32 text-right font-semibold tabular-nums">{formatMoney(customer.spent_pesewas)}</p>
                  </>
                )
                const row = 'flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5'

                return (
                  <li key={customer.id}>
                    {/* Everyone who can see customers can open one; editing is on that page. */}
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className={`${row} hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700`}
                    >
                      {body}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </AppLayout>
  )
}
