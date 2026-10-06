import { Head, Link, router } from '@inertiajs/react'
import { Plus, Search, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'

type SupplierRow = {
  id: number
  name: string
  phone: string | null
  products: string[] // names of what they sell
  purchases_count: number
  spent_pesewas: number
}

type Props = { suppliers: SupplierRow[]; filters: { q: string }; total: number }

const SHOWN = 4

// Props from SuppliersController#index
export default function SuppliersIndex({ suppliers, filters, total }: Props) {
  const manage = useCan()('purchases.manage')
  const [query, setQuery] = useState(filters.q)

  // Search as she types, after a short pause. See Products/Index for notes.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      router.get('/suppliers', { q: query || undefined }, { preserveState: true, replace: true })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <AppLayout>
      <Head title="Suppliers" />

      <PageHeader
        title="Suppliers"
        description="Who you buy from, what each of them sells, and how to reach them."
        actions={
          manage && (
            <ButtonLink href="/suppliers/new">
              <Plus className="size-5" aria-hidden="true" />
              Add a supplier
            </ButtonLink>
          )
        }
      />

      {total === 0 ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Store} title="No suppliers yet">
            Add the people and shops you buy from, with their phone number and what they sell.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="relative mt-5 max-w-md">
            <Search className="pointer-events-none absolute top-3 left-3 size-5 text-taupe-500" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search suppliers"
              placeholder="Search by name, phone or what they sell"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block min-h-11 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
            />
          </div>

          {suppliers.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">No supplier matches "{filters.q}".</p>
          ) : (
            <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
              {suppliers.map((supplier) => (
                <li key={supplier.id}>
                  <Link
                    href={`/suppliers/${supplier.id}`}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                  >
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="truncate font-medium">{supplier.name}</p>
                      <p className="text-sm text-taupe-700 tabular-nums">
                        {supplier.phone ?? <span className="text-amber-800">No phone number yet</span>}
                      </p>
                      <p className="mt-1.5 flex flex-wrap gap-1.5">
                        {supplier.products.length === 0 ? (
                          <span className="text-sm text-taupe-600">Nothing listed yet</span>
                        ) : (
                          <>
                            {supplier.products.slice(0, SHOWN).map((name) => (
                              <span key={name} className="rounded-md border border-taupe-200 bg-taupe-50 px-2 py-0.5 text-sm">
                                {name}
                              </span>
                            ))}
                            {supplier.products.length > SHOWN && (
                              <span className="self-center text-sm text-taupe-700">and {supplier.products.length - SHOWN} more</span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <p className="text-sm text-taupe-700 tabular-nums">
                      {supplier.purchases_count === 1 ? '1 purchase' : `${supplier.purchases_count} purchases`}
                    </p>
                    <p className="w-32 text-right font-semibold tabular-nums">{formatMoney(supplier.spent_pesewas)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppLayout>
  )
}
