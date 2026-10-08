import { useEffect, useState } from 'react'

type Props = {
  /** The colour as "#rrggbb", or null/undefined if none has been chosen. */
  value: string | null | undefined
  onChange: (hex: string) => void
  /** What the colour is for, for screen readers: "Black". */
  label: string
  /** Shown in the picker while nothing is chosen. */
  fallback?: string
}

// What someone might type or paste -> "#rrggbb", or null if it isn't a colour yet.
//   "#C0262D"  "c0262d"  " #c0262d "  -> "#c0262d"
//   "#abc"                             -> "#aabbcc"   (the short form)
//   "#c02"... still typing             -> null
export function readHex(text: string): string | null {
  const digits = text.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(digits)) return `#${digits}`
  if (/^[0-9a-f]{3}$/.test(digits)) return `#${[...digits].map((digit) => digit + digit).join('')}`
  return null
}

// A colour, chosen two ways that stay in step: the browser's colour picker,
// and a box for the hex code. Pick with one and the other follows; paste a
// code from anywhere (a brand guide, another product) and the swatch shows it.
export default function ColourField({ value, onChange, label, fallback = '#b3a396' }: Props) {
  // What is in the text box right now. Kept separately from `value`
  // because while she is typing, "#c02" is not a colour yet: the box must
  // show exactly what she typed, and only a finished code is passed up.
  const [draft, setDraft] = useState(value ?? '')

  // The picker (or anything else) changed the colour: show the new code.
  // Skipped when the box already means the same colour, so "#ABC" isn't
  // rewritten to "#aabbcc" under her cursor.
  useEffect(() => {
    if (readHex(draft) !== (value ?? null)) setDraft(value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const unfinished = draft.trim() !== '' && readHex(draft) === null

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <input
        type="color"
        aria-label={`Colour for ${label}`}
        value={value ?? fallback}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-md border border-taupe-300 bg-white p-0.5"
      />
      <input
        type="text"
        aria-label={`Hex code for ${label}`}
        aria-invalid={unfinished || undefined}
        placeholder="#hex"
        maxLength={9}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const hex = readHex(e.target.value)
          if (hex) onChange(hex)
        }}
        // Leaving the box tidies it up: a finished code is shown in its
        // standard form, an unfinished one goes back to the current colour.
        onBlur={() => setDraft(value ?? '')}
        className={`min-h-9 w-[5.5rem] rounded-md bg-white px-2 py-1 font-mono text-sm focus:ring-1 ${
          unfinished ? 'border-red-700 focus:border-red-700 focus:ring-red-700' : 'border-taupe-300 focus:border-wine-700 focus:ring-wine-700'
        }`}
      />
    </span>
  )
}
