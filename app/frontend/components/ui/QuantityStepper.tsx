import { Minus, Plus } from 'lucide-react'

type Props = {
  /** Kept as text so the box can be empty while she is typing. */
  value: string
  onChange: (value: string) => void
  /** What is being counted, for screen readers: "M / Black". */
  label: string
  max?: number
}

const side =
  'flex size-11 shrink-0 items-center justify-center text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700 disabled:text-taupe-300 disabled:hover:bg-transparent'

// A number box with big minus and plus buttons, for counting things on a phone.
export default function QuantityStepper({ value, onChange, label, max = 100000 }: Props) {
  const number = Number.parseInt(value, 10) || 0
  const set = (next: number) => onChange(next <= 0 ? '' : String(Math.min(next, max)))

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-md border border-taupe-300 bg-white focus-within:border-wine-700">
      <button type="button" className={side} onClick={() => set(number - 1)} disabled={number <= 0} aria-label={`One fewer ${label}`}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Quantity of ${label}`}
        placeholder="0"
        value={value}
        // Digits only. An empty box means zero.
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="w-14 border-0 bg-transparent p-0 text-center text-base tabular-nums placeholder:text-taupe-400 focus:ring-0"
      />
      <button type="button" className={side} onClick={() => set(number + 1)} aria-label={`One more ${label}`}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
