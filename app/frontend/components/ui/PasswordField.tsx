import { useState } from 'react'
import TextField from '@/components/ui/TextField'

type Props = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** "current-password" to log in, "new-password" to choose one (phones then offer a strong one). */
  autoComplete: 'current-password' | 'new-password'
  error?: string | string[]
  hint?: string
  required?: boolean
}

// A password box with a Show / Hide button: on a phone it's easy to mistype
// a password you can't see.
export default function PasswordField({ id, label, value, onChange, autoComplete, error, hint, required = true }: Props) {
  const [shown, setShown] = useState(false)
  return (
    <div>
      <TextField
        id={id}
        label={label}
        type={shown ? 'text' : 'password'}
        required={required}
        maxLength={72}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        trailing={
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-pressed={shown}
            aria-label={shown ? 'Hide password' : 'Show password'}
            className="rounded px-2 py-1.5 text-sm font-medium text-wine-700 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
          >
            {shown ? 'Hide' : 'Show'}
          </button>
        }
      />
      {hint && !error && <p className="mt-1.5 text-sm text-taupe-700">{hint}</p>}
    </div>
  )
}
