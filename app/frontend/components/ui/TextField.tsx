import type { InputHTMLAttributes, ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** Also used as the input's id and name. */
  id: string
  label: string
  /** Validation message from Rails, shown under the field. */
  error?: string | string[]
  /** Something to sit inside the right edge of the input, e.g. a Show button. */
  trailing?: ReactNode
}

// A labelled text input with built-in error display.
// Label, input and error are wired together for screen readers.
export default function TextField({ id, label, error, trailing, className = '', ...props }: Props) {
  const message = Array.isArray(error) ? error[0] : error
  const errorId = `${id}-error`

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-taupe-800">
        {label}
      </label>

      <div className="relative mt-1.5">
        <input
          id={id}
          name={id}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          {...props}
          className={[
            'block min-h-12 w-full rounded-md bg-white px-3.5 text-base text-ink placeholder:text-taupe-400',
            'focus:border-wine-700 focus:ring-1 focus:ring-wine-700',
            message ? 'border-red-700' : 'border-taupe-300',
            trailing ? 'pr-16' : '',
            className,
          ].join(' ')}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>

      {message && (
        <p id={errorId} className="mt-1.5 text-sm text-red-800">
          {message}
        </p>
      )}
    </div>
  )
}
