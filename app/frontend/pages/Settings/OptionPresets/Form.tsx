import { Head, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import TextField from '@/components/ui/TextField'
import OptionValuesEditor from '@/components/OptionValuesEditor'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { confirmAction } from '@/lib/confirm'

type Props = {
  // null when adding; the list when editing.
  preset: { id: number; name: string; option_name: string; values: OptionValue[] } | null
  // Suggestions for the option box ("Size", "Colour", "Length", ...).
  option_names: string[]
}

export default function OptionPresetForm({ preset, option_names }: Props) {
  const editing = preset !== null

  const form = useForm({
    name: preset?.name ?? '',
    option_name: preset?.option_name ?? '',
    values: preset?.values ?? ([] as OptionValue[]),
  })
  const errors = form.errors as Record<string, string[] | undefined>

  // Whether to show colour pickers. Starts on if the list already has colours.
  const [colours, setColours] = useState(preset?.values.some((v) => v.swatch) ?? false)

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
      option_preset: {
        ...data,
        // If colours were switched off, don't send leftover swatches.
        values: data.values.map((v) => (colours ? { label: v.label, swatch: v.swatch ?? '' } : { label: v.label })),
      },
    }))

    if (editing) {
      form.patch(`/admin/settings/options/${preset.id}`)
    } else {
      form.post('/admin/settings/options')
    }
  }

  async function destroy() {
    if (!editing) return
    if (!(await confirmAction(`Delete "${preset.name}"? Products you have already added keep their choices.`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/admin/settings/options/${preset.id}`)
  }

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${preset.name}` : 'Add a list'} />

      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <h2 className="font-display text-3xl font-semibold text-wine-800">
          {editing ? `Edit ${preset.name}` : 'Add a list'}
        </h2>

        {errors.base && <Alert tone="error">{errors.base[0]}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="name"
            label="Name of this list"
            required
            maxLength={40}
            placeholder="e.g. Letter sizes"
            autoFocus={!editing}
            value={form.data.name}
            onChange={(e) => form.setData('name', e.target.value)}
            error={errors.name}
          />
          <div>
            <TextField
              id="option_name"
              label="What it describes"
              required
              maxLength={30}
              placeholder="e.g. Size"
              // A datalist offers suggestions but still lets her type anything.
              list="option-name-suggestions"
              value={form.data.option_name}
              onChange={(e) => form.setData('option_name', e.target.value)}
              error={errors.option_name}
            />
            <datalist id="option-name-suggestions">
              {option_names.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>

        <Checkbox
          label="These are colours"
          description="Lets you pick a colour dot for each choice, so they are quick to spot."
          checked={colours}
          onChange={(e) => setColours(e.target.checked)}
        />

        <OptionValuesEditor
          values={form.data.values}
          onChange={(values) => form.setData('values', values)}
          withSwatches={colours}
          error={errors.values}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add list'}
          </Button>
          <ButtonLink href="/admin/settings/options" variant="secondary">
            Cancel
          </ButtonLink>
          {editing && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete list
            </Button>
          )}
        </div>
      </form>
    </SettingsLayout>
  )
}
