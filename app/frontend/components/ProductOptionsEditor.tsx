import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import Button from '@/components/ui/Button'
import { Swatch } from '@/components/ui/Chip'
import type { OptionValue } from '@/components/OptionValuesEditor'
import type { DraftOption } from '@/lib/variants'

export type Preset = { id: number; name: string; option_name: string; values: OptionValue[] }

type Props = {
  options: DraftOption[]
  onChange: (options: DraftOption[]) => void
  /** The ready-made lists from Settings > Options. */
  presets: Preset[]
  maxOptions: number
  error?: string | string[]
}

const field =
  'block min-h-12 w-full rounded-md border-taupe-300 bg-white px-3.5 text-base focus:border-wine-700 focus:ring-1 focus:ring-wine-700'

// Builds a product's options: which ones it has (Size, Colour, ...) and which
// choices of each it comes in. Like OptionValuesEditor it is controlled:
// the page owns the data and receives every change through onChange.
export default function ProductOptionsEditor({ options, onChange, presets, maxOptions, error }: Props) {
  const message = Array.isArray(error) ? error[0] : error

  // "Size", "Colour", "Length": one quick-add button per kind of list.
  const kinds = [...new Set(presets.map((preset) => preset.option_name))]
  const used = options.map((option) => option.name.toLowerCase())
  const canAdd = options.length < maxOptions

  const replace = (index: number, option: DraftOption) => onChange(options.map((o, i) => (i === index ? option : o)))

  function add(name: string) {
    const lists = presets.filter((preset) => preset.option_name === name)
    // If there is exactly one list for this kind (e.g. Colours), load it
    // straight away. With several (five kinds of Size) she picks one.
    const choices = lists.length === 1 ? lists[0].values : []
    onChange([...options, { name, choices, selected: [] }])
  }

  return (
    <div className="space-y-4">
      {options.map((option, index) => (
        <OptionCard
          key={index}
          option={option}
          presets={presets}
          onChange={(next) => replace(index, next)}
          onRemove={() => onChange(options.filter((_, i) => i !== index))}
        />
      ))}

      {message && <p className="text-sm text-red-800">{message}</p>}

      {canAdd ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-taupe-700">{options.length === 0 ? 'Add an option:' : 'Add another:'}</span>
          {kinds
            .filter((kind) => !used.includes(kind.toLowerCase()))
            .map((kind) => (
              <Button key={kind} type="button" variant="secondary" className="min-h-10! px-3!" onClick={() => add(kind)}>
                <Plus className="size-4" aria-hidden="true" />
                {kind}
              </Button>
            ))}
          <Button type="button" variant="secondary" className="min-h-10! px-3!" onClick={() => add('')}>
            <Plus className="size-4" aria-hidden="true" />
            Something else
          </Button>
        </div>
      ) : (
        <p className="text-sm text-taupe-700">A product can have up to {maxOptions} options.</p>
      )}
    </div>
  )
}

type CardProps = {
  option: DraftOption
  presets: Preset[]
  onChange: (option: DraftOption) => void
  onRemove: () => void
}

function OptionCard({ option, presets, onChange, onRemove }: CardProps) {
  const [draft, setDraft] = useState('')
  const title = option.name || 'New option'

  // Lists of the same kind first ("Size" lists for a Size option).
  const sameKind = presets.filter((preset) => preset.option_name.toLowerCase() === option.name.toLowerCase())
  const offered = sameKind.length > 0 ? sameKind : presets

  function loadPreset(id: string) {
    const preset = presets.find((p) => String(p.id) === id)
    if (!preset) return

    // Keep anything already ticked, then offer the list's choices.
    const ticked = option.choices.filter((choice) => option.selected.includes(choice.label))
    const known = new Set(ticked.map((choice) => choice.label.toLowerCase()))
    const fresh = preset.values.filter((value) => !known.has(value.label.toLowerCase()))

    onChange({ ...option, name: option.name || preset.option_name, choices: [...ticked, ...fresh] })
  }

  function toggle(label: string) {
    const selected = option.selected.includes(label)
      ? option.selected.filter((l) => l !== label)
      : [...option.selected, label]
    onChange({ ...option, selected })
  }

  // "Teal, Lilac" -> ticked. New ones are added to the choices; ones already
  // on offer are simply ticked.
  function addDraft() {
    const byLabel = new Map(option.choices.map((choice) => [choice.label.toLowerCase(), choice.label]))
    const fresh: OptionValue[] = []
    const toTick: string[] = []

    for (const part of draft.split(/[,\n]/)) {
      const label = part.trim().replace(/\s+/g, ' ')
      if (!label) continue

      const existing = byLabel.get(label.toLowerCase())
      if (existing) {
        toTick.push(existing)
      } else {
        byLabel.set(label.toLowerCase(), label)
        fresh.push({ label })
        toTick.push(label)
      }
    }

    if (toTick.length) {
      onChange({
        ...option,
        choices: [...option.choices, ...fresh],
        selected: [...new Set([...option.selected, ...toTick])],
      })
    }
    setDraft('')
  }

  function onDraftKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addDraft()
    }
  }

  const allTicked = option.choices.length > 0 && option.selected.length === option.choices.length

  return (
    <fieldset className="rounded-lg border border-taupe-200 bg-white p-4">
      <legend className="sr-only">{title}</legend>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-36 flex-1">
          <label className="block text-sm font-medium text-taupe-800">
            Option
            <input
              value={option.name}
              maxLength={30}
              placeholder="e.g. Size"
              onChange={(e) => onChange({ ...option, name: e.target.value })}
              className={`${field} mt-1.5 font-normal`}
            />
          </label>
        </div>
        <div className="min-w-44 flex-1">
          <label className="block text-sm font-medium text-taupe-800">
            Choices from
            {/* value="" so it snaps back: picking a list is an action, not a setting. */}
            <select value="" onChange={(e) => loadPreset(e.target.value)} className={`${field} mt-1.5 font-normal`}>
              <option value="">Pick a list…</option>
              {offered.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          className="flex size-12 items-center justify-center rounded-md text-taupe-700 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </button>
      </div>

      {option.choices.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-taupe-700">
              Tap the ones this product comes in. <span className="font-medium text-ink">{option.selected.length} ticked.</span>
            </p>
            <button
              type="button"
              onClick={() => onChange({ ...option, selected: allTicked ? [] : option.choices.map((c) => c.label) })}
              className="shrink-0 rounded px-2 py-1.5 text-sm font-medium text-wine-700 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
            >
              {allTicked ? 'Clear' : 'Tick all'}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {option.choices.map((choice) => {
              const on = option.selected.includes(choice.label)
              return (
                // aria-pressed tells screen readers this is an on/off button.
                <button
                  key={choice.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(choice.label)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 ${
                    on
                      ? 'border-wine-800 bg-wine-800 text-taupe-50'
                      : 'border-taupe-300 bg-white text-taupe-800 hover:border-wine-700'
                  }`}
                >
                  {choice.swatch && <Swatch colour={choice.swatch} className="size-4" />}
                  {choice.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKey}
          aria-label={`Add your own choice to ${title}`}
          placeholder={option.choices.length ? 'Not in the list? Type it here' : 'Type choices: S, M, L'}
          className={`${field} min-h-11!`}
        />
        <Button type="button" variant="secondary" className="min-h-11! px-4!" onClick={addDraft} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </fieldset>
  )
}
