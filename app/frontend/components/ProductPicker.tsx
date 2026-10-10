import { ChevronDown, Search, Shirt } from 'lucide-react'
import { useState } from 'react'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney } from '@/lib/format'
import VariantChooser from '@/components/VariantChooser'
import { rankProducts } from '@/lib/search'

export type SellableVariant = {
  id: number
  name: string
  option_values: (OptionValue & { name: string })[]
  stock: number
  price_pesewas: number
}
export type SellableProduct = { id: number; name: string; thumb_url: string | null; variants: SellableVariant[] }

type Props = {
  /** The question above the search box: "What are they buying?" */
  label: string
  products: SellableProduct[]
  /** What is picked so far: variant id -> quantity. Owned by the parent. */
  basket: Record<number, number>
  /** One more of this variant, please. */
  onAdd: (variant: SellableVariant) => void
  /** Tapping a SOLD OUT size calls this (to put the buyer on the waiting
      list). Leave out and sold-out sizes can't be tapped. */
  onWaitlist?: (variant: SellableVariant, product: SellableProduct) => void
}

// Search the products and tap to add one. A product with sizes or colours
// opens a step-by-step chooser (VariantChooser) showing only what is in
// stock; a simple product is added in one tap.
//
// It was the middle of SaleCapture until editing an order needed exactly the
// same list. It keeps only its own business (the search text, which product
// is open); what has been picked belongs to whoever is using it.
export default function ProductPicker({ label, products, basket, onAdd, onWaitlist }: Props) {
  const [search, setSearch] = useState('')
  const [openProduct, setOpenProduct] = useState<number | null>(null)

  const left = (variant: SellableVariant) => variant.stock - (basket[variant.id] ?? 0)
  const addOne = onAdd

  const term = search.trim().toLowerCase()
  // Understands sizes and colours: "orange 3xl" (lib/search.ts). Best match first.
  const ranked = term ? rankProducts(term, products) : products.map((product) => ({ product, best: [] as SellableVariant[] }))
  const shown = ranked.map((entry) => entry.product)
  // The sizes/colours the search singled out, per product, to mark them.
  const pointed = new Set(
    ranked.flatMap(({ product, best }) => (best.length < product.variants.length ? best.map((variant) => variant.id) : [])),
  )
  // A search that points at particular sizes opens the top product, so
  // they are one tap away.
  const autoOpen = ranked.length > 0 && ranked[0].best.length < ranked[0].product.variants.length ? ranked[0].product.id : null

  function tapProduct(product: SellableProduct) {
    // A product with nothing to choose between is added in one tap.
    if (product.variants.length === 1 && product.variants[0].option_values.length === 0) {
      if (left(product.variants[0]) > 0) addOne(product.variants[0])
    } else {
      setOpenProduct(openProduct === product.id ? null : product.id)
    }
  }

  return (
    <div>
      <label htmlFor="sale-search" className="block text-sm font-medium text-taupe-800">
        {label}
      </label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-taupe-500" aria-hidden="true" />
        <input
          id="sale-search"
          type="search"
          placeholder="Product, size or colour: orange 3xl"
          autoComplete="off"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpenProduct(null) // let a new search open its own best match
          }}
          className="block min-h-12 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
        />
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-center text-taupe-700">
          {term ? `No product matches "${search.trim()}".` : 'You have no products to sell yet.'}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-taupe-200 overflow-hidden rounded-lg border border-taupe-200 bg-white">
          {shown.map((product) => {
            const stock = product.variants.reduce((sum, variant) => sum + Math.max(left(variant), 0), 0)
            const simple = product.variants.length === 1 && product.variants[0].option_values.length === 0
            const open = openProduct === product.id || (openProduct === null && autoOpen === product.id)
            const inBasket = product.variants.reduce((sum, variant) => sum + (basket[variant.id] ?? 0), 0)
            const prices = product.variants.map((variant) => variant.price_pesewas)
            const from = Math.min(...prices)

            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => tapProduct(product)}
                  disabled={stock === 0 && inBasket === 0}
                  aria-expanded={simple ? undefined : open}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="flex aspect-[4/5] w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-taupe-200 text-taupe-500">
                    {product.thumb_url ? (
                      <img src={product.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <Shirt className="size-5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{product.name}</span>
                    <span className="block text-sm text-taupe-700 tabular-nums">
                      {Math.max(...prices) === from ? formatMoney(from) : `from ${formatMoney(from)}`}
                      {stock === 0 ? ', none left' : `, ${stock} left`}
                    </span>
                  </span>
                  {inBasket > 0 && (
                    <span className="flex size-7 items-center justify-center rounded-full bg-wine-800 text-sm font-semibold text-taupe-50 tabular-nums">
                      {inBasket}
                    </span>
                  )}
                  {!simple && (
                    <ChevronDown
                      className={`size-5 shrink-0 text-taupe-500 transition-transform ${open ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {/* The sizes and colours, shown when the product is tapped:
                    only what is in stock, chosen step by step. */}
                {open && !simple && (
                  <VariantChooser
                    product={product}
                    left={left}
                    basket={basket}
                    onAdd={addOne}
                    onWaitlist={onWaitlist}
                    pointed={product.variants.filter((variant) => pointed.has(variant.id))}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
