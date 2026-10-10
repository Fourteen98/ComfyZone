import { Link } from '@inertiajs/react'
import { Shirt } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMoney } from '@/lib/format'

export type BagLineData = {
  variant_id: number
  product: string
  path: string
  option_values: { name: string; label: string }[]
  thumb_url: string | null
  quantity: number
  available: number
  short: boolean
  unit_price_pesewas: number
  /** The normal price, when the bulk price is on for this line. */
  was_pesewas: number | null
  total_pesewas: number
}

// One thing in the bag: photo, what it is, the price. `children` is the
// slot for whatever the page wants beside it (a stepper in the bag, nothing
// at checkout), which is what lets three pages share this one row.
export default function BagLine({ line, children }: { line: BagLineData; children?: ReactNode }) {
  return (
    <div className="flex gap-4">
      <Link
        href={line.path}
        className="block aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-lg bg-taupe-200"
        tabIndex={-1}
        aria-hidden="true"
      >
        {line.thumb_url ? (
          <img src={line.thumb_url} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-taupe-400">
            <Shirt className="size-6" />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={line.path} className="font-display text-xl leading-tight font-semibold text-wine-800 hover:underline">
              {line.product}
            </Link>
            {line.option_values.length > 0 && (
              <p className="text-sm text-taupe-700">{line.option_values.map((value) => value.label).join(', ')}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-medium tabular-nums">{formatMoney(line.total_pesewas)}</p>
            {line.was_pesewas !== null && (
              <p className="text-sm text-emerald-800 tabular-nums">
                Bulk price, <span className="text-taupe-500 line-through">{formatMoney(line.was_pesewas)}</span>{' '}
                {formatMoney(line.unit_price_pesewas)} each
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
