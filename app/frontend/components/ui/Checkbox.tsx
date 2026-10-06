import type { InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  /** A second, quieter line under the label. */
  description?: string
}

// A checkbox whose whole row is tappable, sized for thumbs.
export default function Checkbox({ label, description, className = '', ...props }: Props) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-taupe-100 has-disabled:cursor-not-allowed has-disabled:opacity-60 ${className}`}
    >
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 size-5 rounded border-taupe-400 text-wine-800 focus:ring-wine-700"
      />
      <span>
        <span className="block">{label}</span>
        {description && <span className="block text-sm text-taupe-700">{description}</span>}
      </span>
    </label>
  )
}
