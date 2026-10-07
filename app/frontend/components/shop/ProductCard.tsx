import { Link } from '@inertiajs/react'
import { Shirt } from 'lucide-react'
import { Swatch } from '@/components/ui/Chip'
import { formatMoney } from '@/lib/format'

export type ShopCard = {
  path: string
  name: string
  category: string | null
  cover_url: string | null
  price_from_pesewas: number
  varies: boolean // variants have different prices: show "From"
  sold_out: boolean
  swatches: string[]
}

// One product in the shop's grid. The whole card is one link.
export default function ProductCard({ product }: { product: ShopCard }) {
  return (
    <Link href={product.path} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wine-700">
      {/* 4:5, the shape the photos are cropped to. */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-taupe-200">
        {product.cover_url ? (
          <img
            src={product.cover_url}
            alt=""
            loading="lazy"
            className={`size-full object-cover transition duration-500 group-hover:scale-[1.03] ${product.sold_out ? 'opacity-60 grayscale-[40%]' : ''}`}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-taupe-400">
            <Shirt className="size-12" aria-hidden="true" />
          </span>
        )}
        {product.sold_out && (
          <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold tracking-wide text-taupe-800 uppercase">
            Sold out
          </span>
        )}
      </div>

      <div className="mt-3">
        <h3 className="font-display text-xl leading-tight font-semibold text-wine-800 group-hover:underline sm:text-2xl">{product.name}</h3>
        <p className="mt-1 flex items-center justify-between gap-3">
          <span className="text-taupe-800 tabular-nums">
            {product.varies && <span className="text-sm text-taupe-600">From </span>}
            {formatMoney(product.price_from_pesewas)}
          </span>
          {product.swatches.length > 1 && (
            <span className="flex gap-1" aria-label={`${product.swatches.length} colours`}>
              {product.swatches.map((colour) => (
                <Swatch key={colour} colour={colour} className="size-3" />
              ))}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}
