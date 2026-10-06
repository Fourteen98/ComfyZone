import type { InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string
  /** Leave out for a bare input, e.g. inside a table row. Then pass aria-label. */
  label?: string
  hint?: string
  error?: string | string[]
}

// An amount in cedis. She types "120" or "120.50"; Rails turns it into
// pesewas (see app/models/pesewas.rb). inputMode="decimal" brings up the
// number keypad with a decimal point on phones.
export default function MoneyField({ id, label, hint, error, className = '', ...props }: Props) {
  const message = Array.isArray(error) ? error[0] : error

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-taupe-800">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-taupe-600">GH₵</span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={message ? true : undefined}
          {...props}
          className={[
            'block min-h-12 w-full rounded-md bg-white pr-3.5 pl-14 text-base text-ink tabular-nums placeholder:text-taupe-400',
            'focus:border-wine-700 focus:ring-1 focus:ring-wine-700',
            message ? 'border-red-700' : 'border-taupe-300',
            className,
          ].join(' ')}
        />
      </div>
      {hint && !message && <p className="mt-1.5 text-sm text-taupe-700">{hint}</p>}
      {message && <p className="mt-1.5 text-sm text-red-800">{message}</p>}
    </div>
  )
}
