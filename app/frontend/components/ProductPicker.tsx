import { ChevronDown, Search, Shirt } from 'lucide-react'
import { useState } from 'react'
import { Swatch } from '@/components/ui/Chip'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney } from '@/lib/format'

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
}

// Search the products and tap to add one. A product with sizes or colours
// opens to show them; a simple product is added in one tap.
//
// It was the middle of SaleCapture until editing an order needed exactly the
// same list. It keeps only its own business (the search text, which product
// is open); what has been picked belongs to whoever is using it.
export default function ProductPicker({ label, products, basket, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [openProduct, setOpenProduct] = useState<number | null>(null)

  const left = (variant: SellableVariant) => variant.stock - (basket[variant.id] ?? 0)
  const addOne = onAdd

  const term = search.trim().toLowerCase()
  const shown = products.filter((product) => product.name.toLowerCase().includes(term))

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
          placeholder="Search products"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
            const open = openProduct === product.id
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

                {/* The sizes and colours, shown when the product is tapped. */}
                {open && !simple && (
                  <ul className="grid grid-cols-2 gap-2 bg-taupe-50 px-3 py-3 sm:grid-cols-3">
                    {product.variants.map((variant) => {
                      const remaining = left(variant)
                      const chosen = basket[variant.id] ?? 0
                      return (
                        <li key={variant.id}>
                          <button
                            type="button"
                            onClick={() => addOne(variant)}
                            disabled={remaining <= 0}
                            className={`flex min-h-14 w-full flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 disabled:opacity-45 ${
                              chosen > 0
                                ? 'border-wine-800 bg-wine-50'
                                : 'border-taupe-300 bg-white hover:border-wine-700'
                            }`}
                          >
                            <span className="flex flex-wrap items-center gap-x-1.5 font-medium">
                              {variant.option_values.map((value) => (
                                <span key={value.name} className="inline-flex items-center gap-1">
                                  {value.swatch && <Swatch colour={value.swatch} />}
                                  {value.label}
                                </span>
                              ))}
                            </span>
                            <span className="text-sm text-taupe-700 tabular-nums">
                              {remaining <= 0
                                ? variant.stock === 0
                                  ? 'Sold out'
                                  : 'All in this claim'
                                : `${remaining} left`}
                              {chosen > 0 && <span className="font-semibold text-wine-800">, {chosen} picked</span>}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
