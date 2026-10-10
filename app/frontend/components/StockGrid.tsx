import { Link } from '@inertiajs/react'
import { Swatch } from '@/components/ui/Chip'

type Value = { name: string; label: string; swatch?: string | null }
export type GridVariant = { id: number; name: string; option_values: Value[]; stock: number; level: 'ok' | 'low' | 'out' | string }

// One product's stock as a compact grid instead of a long list.
//
//   Two options that vary (colour and size):    a table
//                M    L    XL   2XL
//     ● Black    –    1    –    –
//     ● Beige    –    –    1    –
//
//   One option that varies (just colours):      tiles
//     ● Black 8   ● Grey 5   ● Yellow 7
//
// Options with a single value for the whole product ("One size", "Maxi")
// say nothing useful in every cell, so the card shows them once instead
// (see `constantOptions`). Every cell opens that item's page, where she can
// see its history and correct the count.
export default function StockGrid({ variants }: { variants: GridVariant[] }) {
  const varying = varyingOptions(variants)

  if (varying.length === 2) {
    // Rows: the colour (the option with swatches), else the one with more values.
    const [a, b] = varying
    const rowsBy =
      hasSwatches(variants, b) || (!hasSwatches(variants, a) && values(variants, b).length > values(variants, a).length) ? b : a
    const colsBy = rowsBy === a ? b : a
    const rows = values(variants, rowsBy)
    const cols = values(variants, colsBy)
    const at = (row: string, col: string) => variants.find((v) => labelOf(v, rowsBy) === row && labelOf(v, colsBy) === col)

    return (
      // Scrolls sideways on a narrow phone if there are many sizes; the
      // colour column stays put (sticky) so she never loses her place.
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-white py-2 pl-3 text-left text-sm font-medium text-taupe-600">
                <span className="sr-only">{rowsBy}</span>
              </th>
              {cols.map((col) => (
                <th key={col.label} scope="col" className="min-w-9 px-0.5 py-2 text-sm font-medium text-taupe-700">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-taupe-100">
                <th scope="row" className="sticky left-0 bg-white py-1 pr-1 pl-3 text-left font-normal">
                  {/* Long colour names are cut short on a phone; the full name is in the tooltip. */}
                  <span className="flex max-w-24 items-center gap-1.5 text-sm sm:max-w-40" title={row.label}>
                    {row.swatch && <Swatch colour={row.swatch} />}
                    <span className="truncate">{row.label}</span>
                  </span>
                </th>
                {cols.map((col) => {
                  const variant = at(row.label, col.label)
                  return (
                    <td key={col.label} className="px-px py-0.5">
                      {variant ? (
                        <Cell variant={variant} label={`${row.label}, ${col.label}`} />
                      ) : (
                        <span className="text-taupe-300">·</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (varying.length === 1) {
    const [name] = varying
    return (
      <ul className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-3">
        {variants.map((variant) => {
          const value = variant.option_values.find((entry) => entry.name === name)
          return (
            <li key={variant.id}>
              <Tile variant={variant}>
                {value?.swatch && <Swatch colour={value.swatch} />}
                <span className="min-w-0 flex-1 truncate">{value?.label}</span>
              </Tile>
            </li>
          )
        })}
      </ul>
    )
  }

  // No choices, or three that all vary: one tile per item.
  return (
    <ul className="grid gap-1.5 p-3 sm:grid-cols-2">
      {variants.map((variant) => (
        <li key={variant.id}>
          <Tile variant={variant}>
            <span className="min-w-0 flex-1 truncate">{variant.option_values.length ? variant.name : 'One item'}</span>
          </Tile>
        </li>
      ))}
    </ul>
  )
}

// One number in the table. Out = a faint dash; low = amber.
function Cell({ variant, label }: { variant: GridVariant; label: string }) {
  const tone =
    variant.level === 'out'
      ? 'text-taupe-300 hover:bg-taupe-100'
      : variant.level === 'low'
        ? 'bg-amber-100 font-semibold text-amber-950 hover:bg-amber-200'
        : 'bg-emerald-50 font-semibold text-ink hover:bg-emerald-100'
  const words = variant.level === 'out' ? 'none left' : `${variant.stock} left${variant.level === 'low' ? ', running low' : ''}`

  return (
    <Link
      href={`/admin/stock/${variant.id}`}
      aria-label={`${label}: ${words}`}
      title={`${label}: ${words}`}
      className={`flex min-h-10 min-w-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-wine-700 ${tone}`}
    >
      {variant.stock > 0 ? variant.stock : '–'}
    </Link>
  )
}

function Tile({ variant, children }: { variant: GridVariant; children: React.ReactNode }) {
  const tone =
    variant.level === 'out'
      ? 'border-taupe-200 text-taupe-500'
      : variant.level === 'low'
        ? 'border-amber-300 bg-amber-50'
        : 'border-taupe-200'
  return (
    <Link
      href={`/admin/stock/${variant.id}`}
      className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm hover:border-wine-700 focus-visible:outline-2 focus-visible:outline-wine-700 ${tone}`}
    >
      {children}
      <span className={`text-base font-semibold tabular-nums ${variant.level === 'out' ? 'text-taupe-400' : ''}`}>
        {variant.stock > 0 ? variant.stock : '–'}
      </span>
    </Link>
  )
}

// ---- helpers ---------------------------------------------------------------

const labelOf = (variant: GridVariant, name: string) => variant.option_values.find((value) => value.name === name)?.label

// Each value of an option once, in the order the product lists them.
function values(variants: GridVariant[], name: string): { label: string; swatch?: string | null }[] {
  const seen = new Map<string, { label: string; swatch?: string | null }>()
  variants.forEach((variant) => {
    const value = variant.option_values.find((entry) => entry.name === name)
    if (value && !seen.has(value.label)) seen.set(value.label, { label: value.label, swatch: value.swatch })
  })
  return [...seen.values()]
}

const hasSwatches = (variants: GridVariant[], name: string) => values(variants, name).some((value) => value.swatch)

// Options with more than one value across the product's variants.
export function varyingOptions(variants: GridVariant[]): string[] {
  const names = [...new Set(variants.flatMap((variant) => variant.option_values.map((value) => value.name)))]
  return names.filter((name) => values(variants, name).length > 1)
}

// Options that are the same for every variant: "One size", "Maxi".
export function constantOptions(variants: GridVariant[]): string[] {
  const varying = varyingOptions(variants)
  const names = [...new Set(variants.flatMap((variant) => variant.option_values.map((value) => value.name)))]
  return names.filter((name) => !varying.includes(name)).flatMap((name) => values(variants, name).map((value) => value.label))
}
