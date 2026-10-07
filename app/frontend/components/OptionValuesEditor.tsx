import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import Button from '@/components/ui/Button'
import ColourField from '@/components/ui/ColourField'

export type OptionValue = { label: string; swatch?: string | null }

type Props = {
  values: OptionValue[]
  onChange: (values: OptionValue[]) => void
  /** Show a colour picker beside each choice. */
  withSwatches: boolean
  error?: string | string[]
}

const iconButton =
  'flex size-10 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100 hover:text-wine-800 focus-visible:outline-2 focus-visible:outline-wine-700 disabled:opacity-30 disabled:hover:bg-transparent'

// Edits an ordered list of choices: add several at once, rename, reorder,
// remove. It owns no data itself: the parent passes `values` in and gets
// every change back through `onChange` (a "controlled component"), so the
// same editor can be reused on the product form later.
export default function OptionValuesEditor({ values, onChange, withSwatches, error }: Props) {
  const [draft, setDraft] = useState('')
  const message = Array.isArray(error) ? error[0] : error

  // "S, M, L" -> three choices. Skips blanks and anything already in the list.
  function addDraft() {
    const existing = new Set(values.map((v) => v.label.toLowerCase()))
    const fresh: OptionValue[] = []
    for (const part of draft.split(/[,\n]/)) {
      const label = part.trim().replace(/\s+/g, ' ')
      if (!label || existing.has(label.toLowerCase())) continue
      existing.add(label.toLowerCase())
      fresh.push(withSwatches ? { label, swatch: '#b3a396' } : { label })
    }
    if (fresh.length) onChange([...values, ...fresh])
    setDraft('')
  }

  function onDraftKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault() // don't submit the whole form
      addDraft()
    }
  }

  const update = (index: number, patch: Partial<OptionValue>) =>
    onChange(values.map((value, i) => (i === index ? { ...value, ...patch } : value)))

  const remove = (index: number) => onChange(values.filter((_, i) => i !== index))

  function move(index: number, by: -1 | 1) {
    const next = [...values]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    onChange(next)
  }

  return (
    <div>
      <label htmlFor="new-choices" className="block text-sm font-medium text-taupe-800">
        Add choices
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="new-choices"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKey}
          placeholder="Type one, or several with commas: S, M, L, XL"
          className="block min-h-12 w-full rounded-md border-taupe-300 bg-white px-3.5 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
        />
        <Button type="button" variant="secondary" onClick={addDraft} disabled={!draft.trim()}>
          <Plus className="size-5" aria-hidden="true" />
          Add
        </Button>
      </div>

      {message && <p className="mt-2 text-sm text-red-800">{message}</p>}

      {values.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-taupe-300 px-4 py-6 text-center text-taupe-700">
          No choices yet. Add the first one above.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-taupe-700">
            {values.length === 1 ? '1 choice' : `${values.length} choices`}, shown to you in this order.
          </p>
          <ol className="mt-2 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
            {values.map((value, index) => (
              // Index as key is right here: rows have no id of their own, and
              // keeping the key stable while typing keeps the cursor in place.
              <li key={index} className="flex flex-wrap items-center gap-1 px-2 py-1.5">
                <span className="w-7 text-center text-sm text-taupe-500 tabular-nums">{index + 1}</span>

                {withSwatches && (
                  <ColourField label={value.label} value={value.swatch} onChange={(swatch) => update(index, { swatch })} />
                )}

                <input
                  aria-label={`Choice ${index + 1}`}
                  value={value.label}
                  maxLength={30}
                  onChange={(e) => update(index, { label: e.target.value })}
                  className="min-h-10 min-w-24 flex-1 rounded-md border-transparent bg-transparent px-2 text-base hover:border-taupe-300 focus:border-wine-700 focus:bg-white focus:ring-1 focus:ring-wine-700"
                />

                {/* Kept together, so on a narrow phone all three drop to the
                    next line as one group instead of splitting up. */}
                <span className="ml-auto flex shrink-0">
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${value.label} up`}
                  >
                    <ArrowUp className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => move(index, 1)}
                    disabled={index === values.length - 1}
                    aria-label={`Move ${value.label} down`}
                  >
                    <ArrowDown className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => remove(index)}
                    aria-label={`Remove ${value.label}`}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
