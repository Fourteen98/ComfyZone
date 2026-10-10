import { Search } from 'lucide-react'
import { useState } from 'react'
import { Swatch } from '@/components/ui/Chip'
import { rankProducts } from '@/lib/search'

export type FindableVariant = { id: number; name: string; option_values: { name: string; label: string; swatch?: string | null }[]; stock: number }
export type FindableProduct = { id: number; name: string; variants: FindableVariant[] }

type Props = {
  id: string
  label: string
  products: FindableProduct[]
  onPick: (product: FindableProduct, variant: FindableVariant) => void
  /** Show stock counts beside each size (false on screens where stock isn't the point). */
  showStock?: boolean
}

// Type "kaftan orange 3xl", tap the size. A search box that ends in ONE
// size/colour of one product, for anything that needs a specific item:
// putting someone on the waiting list, for a start. Uses the same matching
// as every other search (lib/search.ts).
export default function VariantFinder({ id, label, products, onPick, showStock = true }: Props) {
  const [search, setSearch] = useState('')
  const results = search.trim() ? rankProducts(search, products).slice(0, 4) : []

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-taupe-800">
        {label}
      </label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-taupe-500" aria-hidden="true" />
        <input
          id={id}
          type="search"
          autoComplete="off"
          placeholder="Product, size or colour: kaftan orange 3xl"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block min-h-12 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
        />
      </div>

      {search.trim() !== '' && results.length === 0 && <p className="mt-2 text-sm text-taupe-700">Nothing matches "{search.trim()}".</p>}

      {results.map(({ product, matches }) => (
        <div key={product.id} className="mt-3">
          <p className="text-sm font-medium text-taupe-800">{product.name}</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {matches.map((variant) => (
              <li key={variant.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(product, variant)
                    setSearch('')
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-md border border-taupe-300 bg-white px-3 text-left hover:border-wine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
                >
                  {variant.option_values.length === 0
                    ? 'One kind'
                    : variant.option_values.map((value) => (
                        <span key={value.name} className="inline-flex items-center gap-1">
                          {value.swatch && <Swatch colour={value.swatch} />}
                          {value.label}
                        </span>
                      ))}
                  {showStock && (
                    <span className={`ml-1 text-sm tabular-nums ${variant.stock > 0 ? 'text-taupe-600' : 'text-red-800'}`}>
                      {variant.stock > 0 ? `${variant.stock} left` : 'sold out'}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
