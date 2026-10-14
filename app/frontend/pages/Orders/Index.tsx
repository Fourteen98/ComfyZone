import { Head, Link, router } from '@inertiajs/react'
import { ChevronLeft, ChevronRight, FilePen, Plus, ReceiptText, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import OrderList from '@/components/OrderList'
import { orderTabs } from '@/lib/orders'
import { useCan } from '@/lib/permissions'
import type { OrderSummary } from '@/lib/orders'

type Option = { value: string; label: string }
type Filters = { status: string; q: string; when: string; pay: string; from: string; delivery: string; channel_id: string; page: number }

// Props from OrdersController#index (see OrderSearch)
type Props = {
  orders: (OrderSummary & { live: string | null })[]
  filters: Filters
  filtering: boolean // any filter besides the tab
  counts: Record<string, number | undefined> // per tab, within the filters; "all" too
  page: { number: number; pages: number; total: number; per: number }
  options: { when: Option[]; pay: Option[]; from: Option[]; delivery: Option[]; channels: Option[] }
  any_orders: boolean
  drafts: number // sales saved halfway
  can_create: boolean
}

// The filters that sit in the filter panel, in the order they are shown.
const groups: { key: 'when' | 'pay' | 'from' | 'delivery' | 'channel_id'; label: string }[] = [
  { key: 'when', label: 'When' },
  { key: 'pay', label: 'Payment' },
  { key: 'channel_id', label: 'Came from' },
  { key: 'from', label: 'Live' },
  { key: 'delivery', label: 'Delivery' },
]

export default function OrdersIndex({ orders, filters, filtering, counts, page, options, any_orders, drafts, can_create }: Props) {
  const can = useCan()
  const [query, setQuery] = useState(filters.q)
  const [open, setOpen] = useState(false) // the filter panel

  // Go to the same page with some filters changed. Changing a filter goes
  // back to page 1; the URL keeps everything, so a filtered list can be
  // bookmarked or shared with whoever packs.
  function go(change: Partial<Filters>) {
    const next = { ...filters, page: 1, ...change }
    const data = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== '' && !(key === 'page' && value === 1)))
    router.get('/admin/orders', data, { preserveState: true, preserveScroll: change.page === undefined, replace: true })
  }

  // Search as she types, after a short pause.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => go({ q: query.trim() }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const tabs = [
    { key: '', label: 'All', count: counts.all ?? 0 },
    ...orderTabs
      .filter((tab) => (counts[tab.key] ?? 0) > 0 || filters.status === tab.key)
      .map((tab) => ({ ...tab, count: counts[tab.key] ?? 0 })),
  ]

  // The filters in use, as chips she can remove one by one.
  const chosen = groups
    .filter((group) => filters[group.key] !== '')
    .map((group) => {
      const list = group.key === 'channel_id' ? options.channels : options[group.key]
      return { key: group.key, label: list.find((option) => option.value === filters[group.key])?.label ?? filters[group.key] }
    })

  // On "To pack" and "To deliver" each order gets one big button, so a
  // packer can work down the list without opening every order.
  const next = filters.status === 'paid' ? 'packed' : filters.status === 'packed' ? 'delivered' : null
  function move(order: OrderSummary) {
    router.patch(`/admin/orders/${order.id}/stage`, { to: next }, { preserveScroll: true }) // -> Orders::StagesController
  }

  const first = (page.number - 1) * page.per + 1
  const last = Math.min(page.number * page.per, page.total)
  const pill = (on: boolean) =>
    `min-h-10 rounded-full border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-wine-700 ${
      on ? 'border-wine-800 bg-wine-800 text-taupe-50' : 'border-taupe-300 bg-white hover:border-wine-700'
    }`

  return (
    <AppLayout>
      <Head title="Orders" />

      <PageHeader
        title="Orders"
        actions={
          can_create && (
            <ButtonLink href="/admin/orders/new">
              <Plus className="size-5" aria-hidden="true" />
              Record a sale
            </ButtonLink>
          )
        }
      />

      {drafts > 0 && (
        <Link
          href="/admin/orders/new"
          className="mt-4 flex items-center gap-2 rounded-lg border border-taupe-200 bg-white px-4 py-3 hover:border-wine-700"
        >
          <FilePen className="size-5 text-wine-800" aria-hidden="true" />
          <span className="flex-1">
            {drafts === 1 ? '1 sale' : `${drafts} sales`} saved as {drafts === 1 ? 'a draft' : 'drafts'}
          </span>
          <span className="font-medium text-wine-800">Finish {drafts === 1 ? 'it' : 'them'}</span>
        </Link>
      )}

      {!any_orders ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={ReceiptText} title="No orders yet">
            Orders appear here as soon as something is claimed on a live, or when you record a sale.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* ---------- Search and filters ---------- */}
          <div className="mt-5 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-3 left-3 size-5 text-taupe-500" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search orders"
                placeholder="Name, phone, @username, #order or product"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block min-h-11 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
              />
            </div>
            <Button
              type="button"
              variant={chosen.length ? 'primary' : 'secondary'}
              onClick={() => setOpen(!open)}
              aria-label={chosen.length ? `Filters, ${chosen.length} on` : 'Filters'}
              aria-expanded={open}
            >
              <SlidersHorizontal className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline">Filters</span>
              {chosen.length > 0 && <span className="tabular-nums">{chosen.length}</span>}
            </Button>
          </div>

          {open && (
            <div className="mt-3 space-y-4 rounded-lg border border-taupe-200 bg-white p-4">
              {groups.map((group) => {
                const list = group.key === 'channel_id' ? options.channels : options[group.key]
                if (list.length === 0) return null
                return (
                  <fieldset key={group.key}>
                    <legend className="mb-2 text-sm font-medium text-taupe-800">{group.label}</legend>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={pill(filters[group.key] === '')} onClick={() => go({ [group.key]: '' })}>
                        Any
                      </button>
                      {list.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={filters[group.key] === option.value}
                          className={pill(filters[group.key] === option.value)}
                          onClick={() => go({ [group.key]: filters[group.key] === option.value ? '' : option.value })}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )
              })}
            </div>
          )}

          {/* What is filtering the list right now, each removable. */}
          {(chosen.length > 0 || filters.q) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {filters.q && (
                <button
                  type="button"
                  onClick={() => (setQuery(''), go({ q: '' }))}
                  className={`${pill(true)} inline-flex items-center gap-1.5`}
                >
                  "{filters.q}"
                  <X className="size-4" aria-label="Remove" />
                </button>
              )}
              {chosen.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => go({ [chip.key]: '' })}
                  className={`${pill(true)} inline-flex items-center gap-1.5`}
                >
                  {chip.label}
                  <X className="size-4" aria-label="Remove" />
                </button>
              ))}
              {filtering && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    go({ q: '', when: '', pay: '', from: '', delivery: '', channel_id: '' })
                  }}
                  className="min-h-10 px-2 text-sm font-medium text-wine-800 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* ---------- Tabs: counts follow the filters above ---------- */}
          <nav aria-label="Show" className="mt-4 flex gap-1 overflow-x-auto border-b border-taupe-200">
            {tabs.map((tab) => {
              const on = filters.status === tab.key
              return (
                <button
                  key={tab.key || 'all'}
                  type="button"
                  onClick={() => go({ status: tab.key })}
                  aria-current={on ? 'page' : undefined}
                  className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 font-medium ${
                    on ? 'border-wine-800 text-wine-800' : 'border-transparent text-taupe-700 hover:border-taupe-300 hover:text-wine-800'
                  }`}
                >
                  {tab.label}
                  <span className="text-sm font-normal tabular-nums opacity-70">{tab.count}</span>
                </button>
              )
            })}
          </nav>

          {orders.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">{filters.q || filtering ? 'No orders match.' : 'Nothing here.'}</p>
          ) : (
            <>
              <p className="mt-4 text-sm text-taupe-600 tabular-nums">
                {page.pages > 1 ? `${first} to ${last} of ${page.total}` : page.total === 1 ? '1 order' : `${page.total} orders`}
              </p>
              <div className="mt-2 overflow-hidden rounded-lg border border-taupe-200 bg-white">
                <OrderList
                  orders={orders}
                  action={
                    next && can('orders.fulfil')
                      ? (order) => (
                          <Button type="button" variant="secondary" onClick={() => move(order)}>
                            {next === 'packed' ? 'Mark as packed' : 'Mark as delivered'}
                          </Button>
                        )
                      : undefined
                  }
                />
              </div>

              {page.pages > 1 && (
                <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
                  <Button type="button" variant="secondary" disabled={page.number <= 1} onClick={() => go({ page: page.number - 1 })}>
                    <ChevronLeft className="size-5" aria-hidden="true" />
                    Newer
                  </Button>
                  <span className="text-sm text-taupe-700 tabular-nums">
                    Page {page.number} of {page.pages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page.number >= page.pages}
                    onClick={() => go({ page: page.number + 1 })}
                  >
                    Older
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
