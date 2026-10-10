import { Hourglass, Plus } from 'lucide-react'
import { useState } from 'react'
import { Swatch } from '@/components/ui/Chip'
import type { SellableProduct, SellableVariant } from '@/components/ProductPicker'

type Props = {
  product: SellableProduct
  /** How many of a variant can still be added (stock less what is already picked). */
  left: (variant: SellableVariant) => number
  basket: Record<number, number>
  onAdd: (variant: SellableVariant) => void
  onWaitlist?: (variant: SellableVariant, product: SellableProduct) => void
  /** Variants a search pointed at ("orange 3xl"): offered as one-tap buttons on top. */
  pointed: SellableVariant[]
}

type Value = { label: string; swatch?: string | null }

// Choosing a size and colour one step at a time, from what is IN STOCK only.
//
//   Colour:  ● Black (4)  ● Wine (2)          <- only colours with any left
//   Size:    M (3)  L (1)                     <- only sizes left in Black
//
// Tapping the last choice adds it. The earlier choices stay, so a second
// size in the same colour is one more tap. Colour comes first (it's what
// the buyer names first on a live); other options follow in the product's
// own order.
//
// Sold-out combinations aren't buttons at all. They sit in one quiet line at
// the bottom, where a tap puts the buyer on the waiting list.
export default function VariantChooser({ product, left, basket, onAdd, onWaitlist, pointed }: Props) {
  const [picks, setChosen] = useState<Record<string, string>>({})

  const names = optionOrder(product)
  const inStock = product.variants.filter((variant) => left(variant) > 0)
  const soldOut = product.variants.filter((variant) => variant.stock <= 0)
  const valueOf = (variant: SellableVariant, name: string) => variant.option_values.find((value) => value.name === name)?.label

  // The variants still possible given the choices made BEFORE option `i`.
  const possibleAt = (i: number) => inStock.filter((variant) => names.slice(0, i).every((name) => valueOf(variant, name) === chosen[name]))

  // The choices that still make sense. If the last Black one went into the
  // basket, "Black" quietly un-chooses itself instead of leaving an empty row.
  const chosen: Record<string, string> = {}
  for (const [i, name] of names.entries()) {
    const label = picks[name]
    if (label === undefined || !possibleAt(i).some((variant) => valueOf(variant, name) === label)) break
    chosen[name] = label
  }

  function choose(i: number, label: string) {
    const name = names[i]
    if (i === names.length - 1) {
      // The last choice: that pins down exactly one variant. Add it.
      const variant = possibleAt(i).find((candidate) => valueOf(candidate, name) === label)
      if (variant) onAdd(variant)
      return
    }
    // An earlier choice: keep it, and forget the later ones (they may not exist in it).
    const next: Record<string, string> = {}
    names.slice(0, i).forEach((earlier) => (next[earlier] = chosen[earlier]))
    next[name] = label
    setChosen(next)
  }

  // Which steps to show: the first, and each one whose earlier steps are chosen.
  const steps = names.filter((_, i) => names.slice(0, i).every((name) => chosen[name] !== undefined))

  return (
    <div className="space-y-3 bg-taupe-50 px-3 py-3">
      {pointed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pointed
            .filter((variant) => left(variant) > 0)
            .map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => onAdd(variant)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-wine-800 px-3 font-medium text-white hover:bg-wine-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
              >
                <Plus className="size-4" aria-hidden="true" />
                {variant.name}
                <span className="text-sm font-normal opacity-80">{left(variant)} left</span>
              </button>
            ))}
        </div>
      )}

      {inStock.length === 0 ? (
        <p className="text-taupe-700">All sold out{Object.keys(basket).length ? ' (or all in this claim)' : ''}.</p>
      ) : (
        steps.map((name) => {
          const i = names.indexOf(name)
          const last = i === names.length - 1
          const values = distinctValues(possibleAt(i), name)
          return (
            <div key={name} data-step={name}>
              <p className="text-sm font-medium text-taupe-800">
                {name}
                {last && <span className="font-normal text-taupe-600"> · tap to add</span>}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {values.map((value) => {
                  const matching = possibleAt(i).filter((variant) => valueOf(variant, name) === value.label)
                  const count = matching.reduce((sum, variant) => sum + left(variant), 0)
                  const picked = last ? matching.reduce((sum, variant) => sum + (basket[variant.id] ?? 0), 0) : 0
                  const on = !last && chosen[name] === value.label
                  return (
                    <button
                      key={value.label}
                      type="button"
                      onClick={() => choose(i, value.label)}
                      aria-pressed={last ? undefined : on}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 ${
                        on
                          ? 'border-wine-800 bg-wine-800 text-white'
                          : picked > 0
                            ? 'border-wine-800 bg-wine-50 text-ink'
                            : 'border-taupe-300 bg-white text-ink hover:border-wine-700'
                      }`}
                    >
                      {value.swatch && <Swatch colour={value.swatch} />}
                      {value.label}
                      <span className={`text-sm font-normal tabular-nums ${on ? 'text-white/80' : 'text-taupe-600'}`}>{count}</span>
                      {picked > 0 && <span className="text-sm font-semibold text-wine-800">· {picked} in</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {soldOut.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-taupe-200 pt-2.5 text-sm text-taupe-600">
          <span>Sold out:</span>
          {soldOut.map((variant, index) =>
            onWaitlist ? (
              <button
                key={variant.id}
                type="button"
                onClick={() => onWaitlist(variant, product)}
                title="Put the buyer on the waiting list for this"
                className="inline-flex items-center gap-1 rounded px-1 underline decoration-taupe-300 underline-offset-4 hover:text-wine-800"
              >
                <Hourglass className="size-3.5" aria-hidden="true" />
                {variant.name}
              </button>
            ) : (
              <span key={variant.id}>
                {variant.name}
                {index < soldOut.length - 1 ? ',' : ''}
              </span>
            ),
          )}
          {onWaitlist && <span className="w-full text-xs">Tap one to put the buyer on its waiting list.</span>}
        </p>
      )}
    </div>
  )
}

// Option names in the order to ask them: any option with colour swatches
// first, then the rest as the product lists them.
function optionOrder(product: SellableProduct): string[] {
  const names: string[] = []
  const swatched = new Set<string>()
  for (const variant of product.variants) {
    for (const value of variant.option_values) {
      if (!names.includes(value.name)) names.push(value.name)
      if (value.swatch) swatched.add(value.name)
    }
  }
  return [...names.filter((name) => swatched.has(name)), ...names.filter((name) => !swatched.has(name))]
}

// Each value of one option once, in the order the variants have them.
function distinctValues(variants: SellableVariant[], name: string): Value[] {
  const seen = new Map<string, Value>()
  for (const variant of variants) {
    const value = variant.option_values.find((entry) => entry.name === name)
    if (value && !seen.has(value.label)) seen.set(value.label, { label: value.label, swatch: value.swatch })
  }
  return [...seen.values()]
}
