import { Head, Link } from '@inertiajs/react'
import { Package, Pencil, Plus, Shirt, Truck } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import StatStrip from '@/components/ui/StatStrip'
import StatusBadge from '@/components/PurchaseStatusBadge'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import PhoneLinks from '@/components/PhoneLinks'

type Props = {
  supplier: {
    id: number
    name: string
    phone: string | null
    where: string | null // place, region or country, and address
    abroad: boolean
    note: string | null
    purchases_count: number
    spent_pesewas: number
    products: { id: number; name: string; archived: boolean; thumb_url: string | null; last_cost_pesewas: number | null }[]
    purchases: { id: number; purchased_on: string; status: 'ordered' | 'received'; units: number; total_pesewas: number }[]
    // Bags, stickers, tape bought from them: expenses. null = not allowed to see expenses.
    supplies: {
      count: number
      spent_pesewas: number
      latest: { id: number; spent_on: string; category: string; items: string[]; amount_pesewas: number }[]
    } | null
  }
}

// Props from SuppliersController#show
export default function SupplierShow({ supplier }: Props) {
  const can = useCan()
  const manage = can('purchases.manage')
  const recordSupplies = can('expenses.manage')
  const supplies = supplier.supplies
  // A dealer of bags and stickers only: no stock boxes sitting there empty.
  const suppliesOnly = !!supplies && supplies.count > 0 && supplier.products.length === 0 && supplier.purchases_count === 0

  return (
    <AppLayout>
      <Head title={supplier.name} />

      <PageHeader
        title={supplier.name}
        description={supplier.note ?? undefined}
        actions={
          (manage || recordSupplies) && (
            <>
              {manage && (
                <ButtonLink href={`/admin/suppliers/${supplier.id}/edit`} variant="secondary">
                  <Pencil className="size-5" aria-hidden="true" />
                  Edit
                </ButtonLink>
              )}
              {/* Supplies (bags, stickers) are expenses, not stock. The form
                  reads ?supplier_id= and starts item by item. */}
              {recordSupplies && (
                <ButtonLink href={`/admin/expenses/new?supplier_id=${supplier.id}`} variant={manage ? 'secondary' : undefined}>
                  <Package className="size-5" aria-hidden="true" />
                  Record supplies
                </ButtonLink>
              )}
              {/* The purchase form reads ?supplier_id= and picks them for her. */}
              {manage && (
                <ButtonLink href={`/admin/purchases/new?supplier_id=${supplier.id}`}>
                  <Plus className="size-5" aria-hidden="true" />
                  Record a purchase
                </ButtonLink>
              )}
            </>
          )
        }
      />

      <div className="mt-4">
        {supplier.phone ? (
          <PhoneLinks phone={supplier.phone} />
        ) : (
          <p className="text-amber-800">No phone number yet. Edit this supplier to add one.</p>
        )}
        {supplier.where && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-taupe-800">
            {supplier.where}
            {supplier.abroad && <Badge tone="brand">Abroad</Badge>}
          </p>
        )}
      </div>

      <div className="mt-6">
        <StatStrip
          stats={
            suppliesOnly
              ? [
                  { label: 'Supplies bought', value: String(supplies.count) },
                  { label: 'On supplies', value: formatMoney(supplies.spent_pesewas) },
                ]
              : [
                  { label: 'Products they sell', value: String(supplier.products.length) },
                  { label: 'Purchases', value: String(supplier.purchases_count) },
                  { label: 'You have spent', value: formatMoney(supplier.spent_pesewas) },
                  ...(supplies && supplies.count > 0 ? [{ label: 'On supplies', value: formatMoney(supplies.spent_pesewas) }] : []),
                ]
          }
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        {!suppliesOnly && (
          <Panel title="What they sell">
            {supplier.products.length === 0 ? (
              <EmptyState icon={Shirt} title="Nothing listed yet">
                Edit this supplier to choose what they sell. Anything you buy from them is added here automatically.
              </EmptyState>
            ) : (
              <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
                {supplier.products.map((product) => (
                  <li key={product.id}>
                    <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-taupe-50">
                      <span className="flex aspect-[4/5] w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-taupe-200 text-taupe-500">
                        {product.thumb_url ? (
                          <img src={product.thumb_url} alt="" className="size-full object-cover" />
                        ) : (
                          <Shirt className="size-5" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{product.name}</span>
                        {product.archived && <Badge tone="muted">Archived</Badge>}
                      </span>
                      <span className="text-right text-sm text-taupe-700 tabular-nums">
                        {product.last_cost_pesewas === null ? (
                          'Not bought yet'
                        ) : (
                          <>
                            Last paid{' '}
                            <span className="block text-base font-semibold text-ink">{formatMoney(product.last_cost_pesewas)}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {!suppliesOnly && (
          <Panel title="Purchases from them">
            {supplier.purchases.length === 0 ? (
              <EmptyState icon={Truck} title="No purchases yet">
                What you buy from {supplier.name} will be listed here.
              </EmptyState>
            ) : (
              <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
                {supplier.purchases.map((purchase) => (
                  <li key={purchase.id}>
                    <Link
                      href={`/admin/purchases/${purchase.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-taupe-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{purchase.purchased_on}</span>
                        <span className="block text-sm text-taupe-700">
                          {purchase.units} {purchase.units === 1 ? 'item' : 'items'}
                        </span>
                      </span>
                      <StatusBadge status={purchase.status} />
                      <span className="w-28 text-right font-semibold tabular-nums">{formatMoney(purchase.total_pesewas)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {supplier.purchases_count > supplier.purchases.length && (
              <p className="mt-8 text-sm text-taupe-700">Showing the latest {supplier.purchases.length}.</p>
            )}
          </Panel>
        )}

        {supplies && supplies.count > 0 && (
          <Panel title="Supplies from them">
            <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
              {supplies.latest.map((expense) => (
                <li key={expense.id}>
                  <Link href={`/admin/expenses/${expense.id}/edit`} className="flex items-baseline gap-3 px-5 py-3 hover:bg-taupe-50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {expense.spent_on}, {expense.category.toLowerCase()}
                      </span>
                      {expense.items.length > 0 && <span className="block text-sm text-taupe-700">{expense.items.join(', ')}</span>}
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(expense.amount_pesewas)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {supplies.count > supplies.latest.length && (
              <Link
                href="/admin/expenses"
                data={{ supplier_id: supplier.id }}
                className="mt-8 inline-block text-sm font-medium text-wine-800 hover:underline"
              >
                See all {supplies.count}
              </Link>
            )}
          </Panel>
        )}
      </div>
    </AppLayout>
  )
}
