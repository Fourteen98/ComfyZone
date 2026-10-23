import { Check, Pipette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PALETTE } from '@/lib/colours'

type Props = {
  /** The colour as "#rrggbb", or null/undefined if none has been chosen. */
  value: string | null | undefined
  onChange: (hex: string) => void
  /** What the colour is for, for screen readers: "Black". */
  label: string
  /** Shown in the picker while nothing is chosen. */
  fallback?: string
  /** Told the NAME of a colour tapped in the grid ("Mustard"), so a form can
   *  fill in an empty name box with it. */
  onPickName?: (name: string) => void
  /** The shop's own colours, offered first in the grid. */
  yours?: { label: string; swatch?: string | null }[]
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

// A colour, chosen three ways that stay in step:
//   - the GRID: tap the swatch and pick from ready-made colours (lib/colours.ts),
//     the shop's own colours first. The quick way, and the usual one.
//   - "Another colour…" in the grid: the browser's own colour picker.
//   - the hex box: paste a code from anywhere (a brand guide, another product).
//
// Every place in the app where a colour is set uses this one field, so they
// all work the same way.
export default function ColourField({ value, onChange, label, fallback = '#b3a396', onPickName, yours = [] }: Props) {
  // What is in the text box right now. Kept separately from `value`
  // because while she is typing, "#c02" is not a colour yet: the box must
  // show exactly what she typed, and only a finished code is passed up.
  const [draft, setDraft] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)

  // The picker (or anything else) changed the colour: show the new code.
  // Skipped when the box already means the same colour, so "#ABC" isn't
  // rewritten to "#aabbcc" under her cursor.
  useEffect(() => {
    if (readHex(draft) !== (value ?? null)) setDraft(value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close the grid on Escape, or a tap anywhere outside it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    const onDown = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const unfinished = draft.trim() !== '' && readHex(draft) === null
  const current = (value ?? '').toLowerCase()

  function pick(hex: string, name: string) {
    onChange(hex.toLowerCase())
    onPickName?.(name)
    setOpen(false)
  }

  // The shop's own colours, without repeats of the grid's.
  const own = yours.filter(
    (colour, index, all): colour is { label: string; swatch: string } =>
      !!colour.swatch && all.findIndex((other) => other.label.toLowerCase() === colour.label.toLowerCase()) === index,
  )

  return (
    <span ref={box} className="relative inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Colour for ${label}: choose from the colour grid`}
        className="size-9 shrink-0 rounded-md border border-taupe-300 bg-white p-0.5 focus-visible:outline-2 focus-visible:outline-wine-700"
      >
        <span className="block size-full rounded ring-1 ring-black/10" style={{ backgroundColor: value ?? fallback }} />
      </button>
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
          unfinished
            ? 'border-red-700 focus:border-red-700 focus:ring-red-700'
            : 'border-taupe-300 focus:border-wine-700 focus:ring-wine-700'
        }`}
      />

      {open && (
        // Phones: a panel along the bottom of the screen, easy for a thumb.
        // Larger screens: a small box under the swatch.
        <div
          role="dialog"
          aria-label={`Colours for ${label}`}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 max-h-[60dvh] overflow-y-auto rounded-xl border border-taupe-200 bg-white p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:top-full sm:bottom-auto sm:left-0 sm:mt-1.5 sm:w-[22rem]"
        >
          {own.length > 0 && (
            <>
              <p className="mb-1.5 text-xs font-medium tracking-wide text-taupe-600 uppercase">Your colours</p>
              <Grid colours={own.map((colour) => ({ name: colour.label, hex: colour.swatch }))} current={current} onPick={pick} />
              <p className="mt-3 mb-1.5 text-xs font-medium tracking-wide text-taupe-600 uppercase">More colours</p>
            </>
          )}
          {/* Without the ones already shown under Your colours. */}
          <Grid
            colours={PALETTE.filter((colour) => !own.some((mine) => mine.label.toLowerCase() === colour.name.toLowerCase()))}
            current={current}
            onPick={pick}
          />

          {/* Not in the grid: the browser's full colour picker. */}
          <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1 text-sm font-medium text-wine-800 hover:bg-taupe-100">
            <Pipette className="size-4" aria-hidden="true" />
            Another colour…
            <input
              type="color"
              value={value ?? fallback}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
              aria-label={`Any colour for ${label}`}
            />
          </label>
        </div>
      )}
    </span>
  )
}

// A grid of round swatches, each named (shown on hover and read aloud).
function Grid({
  colours,
  current,
  onPick,
}: {
  colours: { name: string; hex: string }[]
  current: string
  onPick: (hex: string, name: string) => void
}) {
  return (
    <ul className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
      {colours.map((colour) => {
        const chosen = colour.hex.toLowerCase() === current
        // A tick that shows on light and dark colours alike.
        const light = isLight(colour.hex)
        return (
          <li key={colour.name}>
            <button
              type="button"
              onClick={() => onPick(colour.hex, colour.name)}
              aria-label={colour.name}
              aria-pressed={chosen}
              title={colour.name}
              className={`flex aspect-square w-full items-center justify-center rounded-full ring-1 ring-black/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 ${
                chosen ? 'ring-2 ring-wine-800 ring-offset-2' : 'hover:scale-110'
              } transition-transform`}
              style={{ backgroundColor: colour.hex }}
            >
              {chosen && <Check className={`size-4 ${light ? 'text-ink' : 'text-white'}`} strokeWidth={3} aria-hidden="true" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// Rough brightness, to pick a dark or light tick.
function isLight(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return r * 0.299 + g * 0.587 + b * 0.114 > 160
}
