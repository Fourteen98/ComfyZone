import type { SelectHTMLAttributes } from 'react'

type Option = { value: string | number; label: string }

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Also used as the select's id and name. */
  id: string
  label: string
  options: Option[]
  /** Shown as the first, empty choice. */
  placeholder?: string
  /** Extra guidance under the field. */
  hint?: string
  error?: string | string[]
}

// A labelled dropdown. Same shape as TextField so forms read consistently.
export default function SelectField({ id, label, options, placeholder, hint, error, className = '', ...props }: Props) {
  const message = Array.isArray(error) ? error[0] : error

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-taupe-800">
        {label}
      </label>
      <select
        id={id}
        name={id}
        aria-invalid={message ? true : undefined}
        {...props}
        className={[
          'mt-1.5 block min-h-12 w-full rounded-md bg-white px-3.5 text-base text-ink',
          'focus:border-wine-700 focus:ring-1 focus:ring-wine-700',
          message ? 'border-red-700' : 'border-taupe-300',
          className,
        ].join(' ')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !message && <p className="mt-1.5 text-sm text-taupe-700">{hint}</p>}
      {message && <p className="mt-1.5 text-sm text-red-800">{message}</p>}
    </div>
  )
}
