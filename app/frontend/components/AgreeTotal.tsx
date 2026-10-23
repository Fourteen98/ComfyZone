import { HandCoins } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import MoneyField from '@/components/ui/MoneyField'
import { splitTotal } from '@/lib/agreedTotal'
import type { SplitLine } from '@/lib/agreedTotal'
import { formatMoney, toMoneyInput, toPesewas } from '@/lib/format'

type Props = {
  /** The sale's lines at their USUAL price per piece (bulk included, no bargains). */
  lines: SplitLine[]
  /** What the items come to now (with any agreed prices). */
  total: number
  /** Any line already on an agreed price. */
  agreed: boolean
  /** Set these agreed prices per piece: { lineId: pesewas }. */
  onAgree: (units: Record<number, number>) => void
  /** Drop every agreed price. */
  onUndo: () => void
  /** Shown when there is a delivery fee: the total is for the items only. */
  deliveryExtra?: boolean
}

// "All of it for GH₵ 300": one price for the whole sale, typed while
// recording it. It becomes an agreed price on each item (lib/agreedTotal.ts),
// so stock, profit and the reports treat it like any bargain. Reusable
// anywhere a sale's lines are listed.
export default function AgreeTotal({ lines, total, agreed, onAgree, onUndo, deliveryExtra = false }: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const usual = lines.reduce((sum, line) => sum + line.quantity * line.unit, 0)
  const off = usual - total

  function apply() {
    const target = toPesewas(typed)
    const split = splitTotal(lines, target)
    onAgree(split.units)
    // Rare: e.g. 3 of one item for GH₵ 100 is 33.33 each, 1 pesewa short.
    setNote(split.exact ? null : `${formatMoney(target)} can't be shared out to the pesewa, so it is ${formatMoney(split.total)}.`)
    setOpen(false)
    setTyped('')
  }

  if (open) {
    return (
      <div className="border-t border-taupe-200 bg-taupe-50 px-5 py-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <MoneyField
              id="agreed_total"
              label={deliveryExtra ? 'Price for all the items' : 'Price for everything'}
              placeholder={toMoneyInput(total)}
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault() // not the sale itself
                  if (toPesewas(typed) > 0) apply()
                }
              }}
            />
          </div>
          <Button type="button" onClick={apply} disabled={!(toPesewas(typed) > 0)}>
            Use this price
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
        <p className="mt-2 text-sm text-taupe-700">
          Usually {formatMoney(usual)}. The price is shared across the items by their value
          {deliveryExtra ? '; delivery is added on top' : ''}.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-taupe-200 px-5 py-3 text-sm">
      {agreed && off !== 0 ? (
        <span className="basis-full text-wine-800 tabular-nums sm:flex-1 sm:basis-auto">
          {off > 0 ? `${formatMoney(off)} off` : `${formatMoney(-off)} above`} the usual {formatMoney(usual)}
          {note && <span className="block text-taupe-700">{note}</span>}
        </span>
      ) : (
        <span className="flex-1 text-taupe-700">Bargained for the whole sale?</span>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-taupe-300 bg-white px-3 font-medium text-wine-800 hover:border-wine-700 focus-visible:outline-2 focus-visible:outline-wine-700"
      >
        <HandCoins className="size-4" aria-hidden="true" />
        {agreed ? 'Change price' : 'Set one price'}
      </button>
      {agreed && (
        <button
          type="button"
          onClick={() => {
            onUndo()
            setNote(null)
          }}
          className="min-h-10 px-1 font-medium text-wine-800 hover:underline"
        >
          Usual prices
        </button>
      )}
    </div>
  )
}
