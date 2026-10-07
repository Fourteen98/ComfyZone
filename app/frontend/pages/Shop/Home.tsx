import { Head, Link, router } from '@inertiajs/react'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import logoWall from '@/assets/brand/logo-wall.jpg'
import ShopLayout from '@/layouts/ShopLayout'
import ProductCard from '@/components/shop/ProductCard'
import type { ShopCard } from '@/components/shop/ProductCard'

type Props = {
  products: ShopCard[]
  categories: { slug: string; name: string }[]
  filters: { category: string; q: string }
}

// Props from Shop::ProductsController#index
export default function ShopHome({ products, categories, filters }: Props) {
  const [query, setQuery] = useState(filters.q)
  const browsing = filters.category !== '' || filters.q !== ''

  // Search as they type, after a short pause (the same pattern as the
  // back office's product list).
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      router.get('/', { q: query || undefined, category: filters.category || undefined }, { preserveState: true, replace: true, preserveScroll: true })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const pill = (active: boolean) =>
    `flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
      active ? 'border-wine-800 bg-wine-800 text-white' : 'border-taupe-300 bg-white text-taupe-800 hover:border-wine-700'
    }`

  return (
    <ShopLayout wide>
      <Head title="Shop" />

      {/* The welcome band. Hidden once they are filtering, so results are at the top. */}
      {!browsing && (
        <section className="relative mt-4 overflow-hidden rounded-2xl bg-wine-800 text-white sm:mt-6">
          <img src={logoWall} alt="" className="absolute inset-0 size-full object-cover object-[center_40%] opacity-25 mix-blend-luminosity" />
          <div className="relative px-6 py-12 sm:px-12 sm:py-20">
            <p className="text-xs tracking-[0.3em] text-white/75 uppercase">The Comfy Zone by Fazy</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] font-semibold text-balance sm:text-7xl">Comfort meets style.</h1>
            <p className="mt-4 max-w-md text-lg text-white/85">The pieces from the lives, ready to order any time. Pick yours, and we will get it to you.</p>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {categories.length > 0 && (
          <nav aria-label="Categories" className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Link href="/" data={{ q: filters.q || undefined }} className={pill(filters.category === '')} preserveScroll>
              Everything
            </Link>
            {categories.map((category) => (
              <Link
                key={category.slug}
                href="/"
                data={{ category: category.slug, q: filters.q || undefined }}
                className={pill(filters.category === category.slug)}
                preserveScroll
              >
                {category.name}
              </Link>
            ))}
          </nav>
        )}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-3 left-3.5 size-5 text-taupe-500" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search the shop"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block min-h-11 w-full rounded-full border-taupe-300 bg-white pr-4 pl-11 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <p className="py-20 text-center text-lg text-taupe-700">
          {browsing ? 'Nothing matches that yet.' : 'New pieces are on their way. Please check back soon.'}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.path}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </ShopLayout>
  )
}
