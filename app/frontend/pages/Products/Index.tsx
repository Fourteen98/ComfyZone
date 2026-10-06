import { Head, Link, router } from '@inertiajs/react'
import { Plus, Search, Shirt } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'

type ProductRow = {
  id: number
  name: string
  status: 'active' | 'archived'
  category: string | null
  cover_url: string | null
  variants_count: number
  stock: number | null // null = this person may not see stock
  price_from: number // pesewas
  price_to: number // pesewas
}

type Props = {
  products: ProductRow[]
  filters: { q: string; status: 'active' | 'archived'; category: string }
  counts: { active: number; archived: number }
  // Categories that have products in this view, for the filter chips.
  categories: { slug: string; name: string; count: number }[]
}

// Props from ProductsController#index
export default function ProductsIndex({ products, filters, counts, categories }: Props) {
  const can = useCan()
  const [query, setQuery] = useState(filters.q)

  // Search as she types, after a short pause so we don't ask Rails on every
  // keystroke. The search is a normal GET /products?q=..., so the address bar
  // always matches what is on screen and can be bookmarked or shared.
  useEffect(() => {
    // Nothing to do while the box matches what Rails already searched for.
    // (This also covers the first render.)
    if (query === filters.q) return

    const timer = setTimeout(() => {
      router.get(
        '/products',
        { ...params(filters.category), q: query || undefined },
        { preserveState: true, replace: true },
      )
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // The query string for the current view, with a given category.
  // `undefined` values are left out of the address entirely.
  function params(category: string) {
    return {
      status: filters.status === 'archived' ? 'archived' : undefined,
      q: filters.q || undefined,
      category: category || undefined,
    }
  }

  const tabs = [
    { key: 'active', label: 'Active', count: counts.active, href: '/products' },
    { key: 'archived', label: 'Archived', count: counts.archived, href: '/products?status=archived' },
  ]
  const nothingAtAll = counts.active + counts.archived === 0

  return (
    <AppLayout>
      <Head title="Products" />

      <PageHeader
        title="Products"
        actions={
          can('products.manage') && (
            <ButtonLink href="/products/new">
              <Plus className="size-5" aria-hidden="true" />
              Add a product
            </ButtonLink>
          )
        }
      />

      {nothingAtAll ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Shirt} title="No products yet">
            Add the first thing you sell, with the sizes and colours it comes in.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-taupe-200">
            <nav aria-label="Show" className="flex gap-1">
              {tabs.map((tab) => {
                const active = filters.status === tab.key
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 font-medium ${
                      active
                        ? 'border-wine-800 text-wine-800'
                        : 'border-transparent text-taupe-700 hover:border-taupe-300 hover:text-wine-800'
                    }`}
                  >
                    {tab.label}
                    <span className="text-sm font-normal tabular-nums opacity-70">{tab.count}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="relative mb-2 w-full sm:w-72">
              <Search className="pointer-events-none absolute top-3 left-3 size-5 text-taupe-500" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block min-h-11 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
              />
            </div>
          </div>

          {categories.length > 0 && (
            <nav aria-label="Category" className="mt-4 flex flex-wrap gap-2">
              {[{ slug: '', name: 'All', count: null as number | null }, ...categories].map((category) => {
                const on = filters.category === category.slug
                return (
                  <Link
                    key={category.slug || 'all'}
                    href="/products"
                    data={params(category.slug)}
                    preserveState
                    aria-current={on ? 'true' : undefined}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 ${
                      on
                        ? 'border-wine-800 bg-wine-800 text-taupe-50'
                        : 'border-taupe-300 bg-white text-taupe-800 hover:border-wine-700'
                    }`}
                  >
                    {category.name}
                    {category.count !== null && <span className="font-normal tabular-nums opacity-70">{category.count}</span>}
                  </Link>
                )
              })}
            </nav>
          )}

          {products.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">
              {filters.q
                ? `Nothing matches "${filters.q}".`
                : filters.category
                  ? 'Nothing in this category.'
                  : filters.status === 'archived'
                    ? 'Nothing archived.'
                    : 'No active products.'}
            </p>
          ) : (
            // A catalogue grid: two across on phones, up to five on wide
            // screens. No boxes around the cards; the photos do the work.
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.id}`}
                    className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wine-700"
                  >
                    <div className="aspect-[4/5] overflow-hidden rounded-lg bg-taupe-200">
                      {product.cover_url ? (
                        <img
                          src={product.cover_url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-2 text-taupe-500">
                          <Shirt className="size-10" aria-hidden="true" />
                          <span className="text-sm">No photo yet</span>
                        </div>
                      )}
                    </div>
                    {product.category && <p className="mt-2.5 text-sm text-taupe-600">{product.category}</p>}
                    <p className={`line-clamp-2 leading-snug font-medium group-hover:text-wine-800 ${product.category ? '' : 'mt-2.5'}`}>
                      {product.name}
                    </p>
                    <p className="mt-0.5 font-semibold text-wine-800 tabular-nums">
                      {product.price_from === product.price_to
                        ? formatMoney(product.price_from)
                        : `${formatMoney(product.price_from)} to ${formatMoney(product.price_to)}`}
                    </p>
                    <p className="text-sm text-taupe-700 tabular-nums">
                      {product.variants_count === 1 ? 'One item' : `${product.variants_count} variants`}
                      {product.stock !== null && (product.stock > 0 ? `, ${product.stock} in stock` : ', none in stock')}
                    </p>
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
