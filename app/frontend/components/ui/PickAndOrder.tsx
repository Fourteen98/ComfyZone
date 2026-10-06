import { ArrowDown, ArrowUp } from 'lucide-react'

export type Pick = { key: string; label: string; on: boolean }

type Props = {
  legend: string
  hint?: string
  items: Pick[]
  onChange: (items: Pick[]) => void
  /** The most that may be switched on at once. */
  max?: number
}

const arrow =
  'flex size-10 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100 hover:text-wine-800 focus-visible:outline-2 focus-visible:outline-wine-700 disabled:opacity-30 disabled:hover:bg-transparent'

// Tick the things you want, and arrange them with the arrows.
// The component holds no state of its own: it is handed the list and
// reports every change, so the parent form stays the single owner.
export default function PickAndOrder({ legend, hint, items, onChange, max }: Props) {
  const chosen = items.filter((item) => item.on).length
  const full = max !== undefined && chosen >= max

  function toggle(index: number) {
    onChange(items.map((item, i) => (i === index ? { ...item, on: !item.on } : item)))
  }

  function move(index: number, by: -1 | 1) {
    const next = [...items]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    onChange(next)
  }

  return (
    <fieldset>
      <legend className="font-display text-2xl font-semibold text-wine-800">{legend}</legend>
      {hint && <p className="mt-1 text-taupe-700">{hint}</p>}

      <ul className="mt-3 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center gap-1 pr-2">
            <label
              className={`flex min-h-12 flex-1 cursor-pointer items-center gap-3 px-4 py-2 has-disabled:cursor-not-allowed ${item.on ? '' : 'text-taupe-600'}`}
            >
              <input
                type="checkbox"
                checked={item.on}
                // Once the limit is reached, the rest can't be ticked.
                disabled={!item.on && full}
                onChange={() => toggle(index)}
                className="size-5 rounded border-taupe-400 text-wine-800 focus:ring-wine-700"
              />
              <span className={item.on ? 'font-medium' : ''}>{item.label}</span>
            </label>
            <button type="button" className={arrow} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${item.label} up`}>
              <ArrowUp className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={arrow}
              disabled={index === items.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`Move ${item.label} down`}
            >
              <ArrowDown className="size-5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {max !== undefined && (
        <p className="mt-2 text-sm text-taupe-700" aria-live="polite">
          {chosen} of up to {max} chosen.
        </p>
      )}
    </fieldset>
  )
}
