import { Head, Link, router } from '@inertiajs/react'
import { Plus, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { formatMoney } from '@/lib/format'

type CustomerRow = {
  id: number
  display_name: string
  handle: string | null
  phone: string | null
  location: string | null
  orders_count: number
  spent_pesewas: number
}

type Props = { customers: CustomerRow[]; filters: { q: string }; total: number; can_manage: boolean }

// Props from CustomersController#index
export default function CustomersIndex({ customers, filters, total, can_manage }: Props) {
  const [query, setQuery] = useState(filters.q)

  // Search as she types, after a short pause. See Products/Index for notes.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      router.get('/customers', { q: query || undefined }, { preserveState: true, replace: true })
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
            <ButtonLink href="/customers/new">
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
            <p className="mt-8 text-center text-taupe-700">No customer matches "{filters.q}".</p>
          ) : (
            <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
              {customers.map((customer) => {
                const body = (
                  <>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-medium">{customer.display_name}</p>
                      <p className="truncate text-sm text-taupe-700 tabular-nums">
                        {[customer.handle && customer.display_name !== `@${customer.handle}` ? `@${customer.handle}` : null, customer.phone, customer.location]
                          .filter(Boolean)
                          .join(', ') || 'No details yet'}
                      </p>
                    </div>
                    <p className="text-sm text-taupe-700 tabular-nums">{customer.orders_count === 1 ? '1 order' : `${customer.orders_count} orders`}</p>
                    <p className="w-32 text-right font-semibold tabular-nums">{formatMoney(customer.spent_pesewas)}</p>
                  </>
                )
                const row = 'flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5'

                return (
                  <li key={customer.id}>
                    {can_manage ? (
                      <Link
                        href={`/customers/${customer.id}/edit`}
                        className={`${row} hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className={row}>{body}</div>
                    )}
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
