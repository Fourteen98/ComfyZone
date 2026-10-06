import { Search, Shirt, X } from 'lucide-react'
import { useState } from 'react'

export type PickableProduct = { id: number; name: string; thumb_url: string | null }

type Props = {
  /** Everything that can be chosen. */
  products: PickableProduct[]
  /** The ids chosen so far. */
  value: number[]
  onChange: (ids: number[]) => void
  label: string
}

// Choose several products: search, tap to add, tap the X to remove.
// Controlled, like the other editors: the page owns the list of ids.
export default function ProductMultiPicker({ products, value, onChange, label }: Props) {
  const [search, setSearch] = useState('')

  const chosen = products.filter((product) => value.includes(product.id))
  const term = search.trim().toLowerCase()
  const matches = products.filter((product) => !value.includes(product.id) && product.name.toLowerCase().includes(term)).slice(0, 8)

  return (
    <div>
      <p className="text-sm font-medium text-taupe-800">{label}</p>

      {chosen.length > 0 && (
        <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {chosen.map((product) => (
            <li key={product.id} className="flex items-center gap-3 rounded-md border border-wine-800/30 bg-wine-50 p-2">
              <Thumb url={product.thumb_url} />
              <span className="min-w-0 flex-1 truncate font-medium">{product.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => id !== product.id))}
                aria-label={`Remove ${product.name}`}
                className="flex size-10 items-center justify-center rounded-md text-taupe-700 hover:bg-white hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {products.length === 0 ? (
        <p className="mt-1.5 text-sm text-taupe-700">You have no products yet. Add products first, then come back.</p>
      ) : (
        <>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-taupe-500" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search products to add"
              placeholder={chosen.length ? 'Add another product' : 'Search your products'}
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // Enter must not submit the whole form from this box.
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              className="block min-h-12 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
            />
          </div>

          {matches.length > 0 ? (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {matches.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...value, product.id])
                      setSearch('')
                    }}
                    className="flex w-full items-center gap-3 rounded-md border border-taupe-200 bg-white p-2 text-left hover:border-wine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
                  >
                    <Thumb url={product.thumb_url} />
                    <span className="min-w-0 truncate">{product.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-taupe-700">{term ? `No product matches "${search.trim()}".` : 'Every product is already chosen.'}</p>
          )}
        </>
      )}
    </div>
  )
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="flex aspect-[4/5] w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-taupe-200 text-taupe-500">
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <Shirt className="size-5" aria-hidden="true" />}
    </span>
  )
}
