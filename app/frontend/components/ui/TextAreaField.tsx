import type { TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  error?: string | string[]
}

// A labelled multi-line text box. Same shape as TextField.
export default function TextAreaField({ id, label, error, className = '', ...props }: Props) {
  const message = Array.isArray(error) ? error[0] : error

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-taupe-800">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={3}
        aria-invalid={message ? true : undefined}
        {...props}
        className={[
          'mt-1.5 block w-full rounded-md bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-taupe-400',
          'focus:border-wine-700 focus:ring-1 focus:ring-wine-700',
          message ? 'border-red-700' : 'border-taupe-300',
          className,
        ].join(' ')}
      />
      {message && <p className="mt-1.5 text-sm text-red-800">{message}</p>}
    </div>
  )
}
