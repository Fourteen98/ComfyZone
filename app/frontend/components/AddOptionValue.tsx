import { router, usePage } from '@inertiajs/react'
import type { Page } from '@inertiajs/core'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import { Swatch } from '@/components/ui/Chip'
import ColourField from '@/components/ui/ColourField'
import TextField from '@/components/ui/TextField'

export type ProductOptionInfo = { name: string; colours: boolean; labels: string[] }
export type Suggestion = { label: string; swatch?: string | null }

type Props = {
  productId: number
  productName: string
  options: ProductOptionInfo[]
  /** Known choices per option name (lower case): presets and other products. */
  suggestions: Record<string, Suggestion[]>
  /** After it is saved; the page's props already carry the new variants. */
  onAdded?: (page: Page) => void
}

// "+ Add a colour": the goods in her hands come in a colour (or size) the
// product doesn't have yet. Opens in place, saves the new choice on the
// product and makes its variants (Product#add_option_value), and the page
// she is on reloads its lists without losing what she has typed.
//
// Reusable anywhere a product's variants are listed; it needs only the
// product's options. Hidden for a product with no options at all: giving one
// its first option changes it more than a quick add should (do that on the
// product page).
export default function AddOptionValue({ productId, productName, options, suggestions, onAdded }: Props) {
  const errors = usePage().props.errors as Record<string, string[] | string | undefined>
  const [open, setOpen] = useState(false)
  // Colours first: by far the most common thing to be missing.
  const ordered = [...options].sort((a, b) => Number(b.colours) - Number(a.colours))
  const [optionName, setOptionName] = useState(ordered[0]?.name ?? '')
  const [label, setLabel] = useState('')
  const [swatch, setSwatch] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (ordered.length === 0) return null

  const option = ordered.find((entry) => entry.name === optionName) ?? ordered[0]
  const word = (name: string) => name.toLowerCase()
  const error = open ? errors.option_value : undefined

  // What she might mean: known choices this product doesn't have yet,
  // narrowed by what she has typed.
  const typed = label.trim().toLowerCase()
  const have = new Set(option.labels.map((existing) => existing.toLowerCase()))
  const ideas = (suggestions[option.name.toLowerCase()] ?? [])
    .filter((idea) => !have.has(idea.label.toLowerCase()))
    .filter((idea) => typed === '' || idea.label.toLowerCase().includes(typed))
    .slice(0, 10)

  function close() {
    setOpen(false)
    setLabel('')
    setSwatch(null)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
      >
        <Plus className="size-4" aria-hidden="true" />
        {ordered.length === 1 ? `Add a ${word(option.name)}` : `Add a ${ordered.map((entry) => word(entry.name)).join(' or ')}`}
      </button>
    )
  }

  function save() {
    setSaving(true)
    router.post(
      `/admin/products/${productId}/option_values`, // -> Products::OptionValuesController#create
      { option: option.name, label, swatch: option.colours ? swatch : null },
      {
        preserveState: true,
        preserveScroll: true,
        onSuccess: (page) => {
          if (!(page.props.errors as Record<string, unknown>)?.option_value) {
            close()
            onAdded?.(page)
          }
        },
        onFinish: () => setSaving(false),
      },
    )
  }

  const id = `new_value_${productId}`
  return (
    // Not a <form>: it sits inside the purchase form, and forms can't nest.
    <div className="w-full rounded-lg bg-taupe-100 p-3" role="group" aria-label={`Add to ${productName}`}>
      {ordered.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="What to add">
          {ordered.map((entry) => (
            <button
              key={entry.name}
              type="button"
              role="radio"
              aria-checked={entry.name === option.name}
              onClick={() => setOptionName(entry.name)}
              className={`min-h-10 rounded-full border px-3 text-sm font-medium ${
                entry.name === option.name ? 'border-wine-800 bg-wine-800 text-white' : 'border-taupe-300 bg-white text-taupe-800'
              }`}
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <TextField
            id={id}
            label={`New ${word(option.name)}`}
            placeholder={option.colours ? 'Green' : 'XXL'}
            maxLength={30}
            autoFocus
            autoComplete="off"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault() // would submit the purchase form
                if (label.trim()) save()
              }
            }}
            error={error}
          />
        </div>
        {option.colours && <ColourField value={swatch} onChange={setSwatch} label={label || 'the new colour'} />}
      </div>

      {ideas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ideas.map((idea) => (
            <button
              key={idea.label}
              type="button"
              onClick={() => {
                setLabel(idea.label)
                setSwatch(idea.swatch ?? null)
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-taupe-300 bg-white px-3 text-sm hover:border-wine-700"
            >
              {idea.swatch && <Swatch colour={idea.swatch} />}
              {idea.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={saving || label.trim() === ''}>
          Add {label.trim() || word(option.name)}
        </Button>
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
      </div>
      <p className="mt-2 text-sm text-taupe-700">
        Saved on {productName} straight away
        {ordered.length > 1 &&
          `, in every ${ordered
            .filter((entry) => entry.name !== option.name)
            .map((entry) => word(entry.name))
            .join(' and ')} it comes in`}
        . It sells at the product's price unless you change it.
      </p>
    </div>
  )
}
