import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { COUNTRIES, HOME, formatPhone, joinPhone, phoneComplete, splitPhone } from '@/lib/phone'
import type { Country } from '@/lib/phone'

type Props = {
  id: string
  label: string
  /** "+233242223333", or whatever was saved before (it is read the same way), or "". */
  value: string
  /** Gets "+233242223333" (or "" when emptied). */
  onChange: (phone: string) => void
  required?: boolean
  error?: string | string[]
  /** A line under the box, shown while there is no error and nothing typed. */
  hint?: string
  autoFocus?: boolean
}

// A phone number box that knows about country codes.
//
//   - Ghana (+233) is chosen to start with, so she just types 024 222 3333.
//   - The 0 at the front is understood: 024... and 24... are the same number.
//   - Paste anything ("+233 24 222 3333", "233242223333", "+44 7700 900123")
//     and it is split into the right country and number.
//   - Under the box it shows the number as it will be saved, with a tick
//     once it has the right number of digits.
//
// What the parent gets is always one standard shape, +233242223333, the same
// one Rails stores. That shape is what makes the number a reliable way to
// recognise a customer.
// What the box currently means, in the stored shape.
function shapeOf(typed: string, country: Country): string {
  if (typed.startsWith('+')) {
    const digits = typed.replace(/\D/g, '')
    return digits ? `+${digits}` : ''
  }
  return joinPhone(country, splitPhone(typed, country).local)
}

export default function PhoneField({ id, label, value, onChange, required, error, hint, autoFocus }: Props) {
  const start = splitPhone(value)
  const [country, setCountry] = useState<Country>(start.country.code ? start.country : HOME)
  // The digits as she typed them (spaces and the leading 0 kept), so the box
  // never rewrites what is under her cursor.
  const [typed, setTyped] = useState(start.local)

  // A new value from outside (the form was reset, a customer was picked).
  useEffect(() => {
    // Already showing this number (it is what we just sent up): leave the box alone.
    if (value === shapeOf(typed, country)) return
    const next = splitPhone(value, country)
    if (next.country.code) setCountry(next.country)
    setTyped(next.local)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function type(text: string) {
    // A + (or 00) at the front means the number carries its own country.
    // As soon as the digits after it spell a code we know (+44, +233),
    // switch to that country and keep only the rest in the box. Until then
    // ("+2", "+23") the + stays in the box so she can keep typing.
    if (/^\s*(\+|00)/.test(text)) {
      const next = splitPhone(text, country)
      if (next.country.code) {
        setCountry(next.country)
        setTyped(next.local)
        onChange(joinPhone(next.country, next.local))
      } else {
        const digits = text.replace(/\D/g, '').replace(/^00/, '')
        setTyped(`+${digits}`)
        // A code we don't list (+351...): sent as typed, Rails keeps it.
        onChange(digits ? `+${digits}` : '')
      }
      return
    }
    const clean = text.replace(/[^\d\s-]/g, '').replace(/^\s+/, '').slice(0, 20)
    setTyped(clean)
    onChange(joinPhone(country, splitPhone(clean, country).local))
  }

  const unlisted = typed.startsWith('+')
  const local = unlisted ? typed.replace(/\D/g, '') : splitPhone(typed, country).local
  const message = Array.isArray(error) ? error[0] : error
  const done = !unlisted && local !== '' && phoneComplete(country, local)
  const saved = unlisted ? `+${local}` : joinPhone(country, local)

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-taupe-800">
        {label}
      </label>
      <div
        className={`flex min-h-12 items-stretch overflow-hidden rounded-md border bg-white focus-within:ring-1 ${
          message ? 'border-red-700 focus-within:ring-red-700' : 'border-taupe-300 focus-within:border-wine-700 focus-within:ring-wine-700'
        }`}
      >
        {/* The country, as a real <select> so phones show their own picker. */}
        <label className="relative flex shrink-0 items-center border-r border-taupe-200 bg-taupe-50 pr-2 pl-3">
          <span className="sr-only">Country code</span>
          <span aria-hidden="true" className="pointer-events-none text-base tabular-nums">
            {country.flag} +{country.code}
          </span>
          <select
            value={country.code}
            onChange={(e) => {
              const next = COUNTRIES.find((entry) => entry.code === e.target.value) ?? HOME
              setCountry(next)
              onChange(joinPhone(next, local))
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {COUNTRIES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.flag} {entry.name} (+{entry.code})
              </option>
            ))}
          </select>
        </label>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          autoFocus={autoFocus}
          aria-invalid={message ? true : undefined}
          aria-describedby={`${id}_status`}
          placeholder={country.example}
          value={typed}
          onChange={(e) => type(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-ink tabular-nums placeholder:text-taupe-400 focus:ring-0"
        />
        {done && (
          <span className="flex items-center pr-3 text-emerald-700" title="Looks right">
            <Check className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p id={`${id}_status`} className={`mt-1.5 text-sm ${message ? 'text-red-800' : 'text-taupe-700'}`}>
        {message ??
          (local === ''
            ? hint
            : done
              ? `Saved as ${formatPhone(saved)}`
              : unlisted
                ? `Will be saved as ${saved}`
                : country.length
                ? `${country.name} numbers have ${country.length} digits after +${country.code} (${local.length} so far)`
                : `Will be saved as ${saved}`)}
      </p>
    </div>
  )
}
