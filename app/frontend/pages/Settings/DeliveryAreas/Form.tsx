import { Head, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import MoneyField from '@/components/ui/MoneyField'
import SelectField from '@/components/ui/SelectField'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'

type Props = {
  // null when adding; the area when editing.
  area: { id: number; name: string; region: string; fee: string; active: boolean; orders_count: number } | null
  regions: string[]
  // Editing only: the other places, to fold a misspelt twin into this one.
  others?: { value: number; label: string }[]
}

export default function DeliveryAreaForm({ area, regions, others = [] }: Props) {
  const [twin, setTwin] = useState('')

  async function merge() {
    const other = others.find((o) => String(o.value) === twin)
    if (!area || !other) return
    const sure = await confirmAction(
      `Merge ${other.label} into ${area.name}? Its customers and orders move to ${area.name}, and ${other.label} is removed. This can't be undone.`,
      { confirm: 'Merge them' },
    )
    if (sure) router.post(`/settings/areas/${area.id}/merge`, { other_id: other.value })
  }

  const editing = area !== null

  const form = useForm({
    name: area?.name ?? '',
    region: area?.region ?? '',
    fee: area && area.fee !== '0' ? area.fee : '',
    active: area?.active ?? true,
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ delivery_area: data }))

    if (editing) {
      form.patch(`/settings/areas/${area.id}`)
    } else {
      form.post('/settings/areas')
    }
  }

  async function destroy() {
    if (!editing) return
    const kept = area.orders_count === 0 ? '' : ' Orders sent there keep their fee, and customers there keep their region.'
    if (!(await confirmAction(`Delete "${area.name}"?${kept}`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/settings/areas/${area.id}`)
  }

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${area.name}` : 'Add a place'} />

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <h2 className="font-display text-3xl font-semibold text-wine-800">{editing ? `Edit ${area.name}` : 'Add a place'}</h2>

        <SelectField
          id="region"
          label="Region"
          required
          placeholder="Choose one"
          options={regions.map((region) => ({ value: region, label: region }))}
          value={form.data.region}
          onChange={(e) => {
            form.setData('region', e.target.value)
            form.clearErrors('region')
          }}
          error={errors.region}
        />

        <TextField
          id="name"
          label="Name"
          required
          maxLength={40}
          placeholder="e.g. East Legon"
                    value={form.data.name}
          onChange={(e) => {
            form.setData('name', e.target.value)
            form.clearErrors('name')
          }}
          error={errors.name}
        />

        <MoneyField
          id="fee"
          label="Usual delivery fee"
          hint="What the buyer pays. Leave empty if delivery there is free."
          value={form.data.fee}
          onChange={(e) => {
            form.setData('fee', e.target.value)
            form.clearErrors('fee')
          }}
          error={errors.fee}
        />

        {editing && (
          <Checkbox
            label="Offer this when recording a sale"
            description="Untick to hide it without deleting."
            checked={form.data.active}
            onChange={(e) => form.setData('active', e.target.checked)}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add place'}
          </Button>
          <ButtonLink href="/settings/areas" variant="secondary">
            Cancel
          </ButtonLink>
          {editing && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete place
            </Button>
          )}
        </div>
      </form>

      {editing && others.length > 0 && (
        <div className="mt-10 max-w-xl rounded-lg border border-taupe-200 bg-white p-5">
          <h3 className="font-display text-2xl font-semibold text-wine-800">Spelt two ways?</h3>
          <p className="mt-1 mb-4 text-taupe-700">
            If the same place is also in the list under another spelling, choose it here to fold it into this one.
          </p>
          <SelectField id="twin" label="The other spelling" placeholder="Choose a place" options={others} value={twin} onChange={(e) => setTwin(e.target.value)} />
          {twin !== '' && (
            <Button type="button" variant="secondary" className="mt-4" onClick={merge}>
              Merge it into {area.name}
            </Button>
          )}
        </div>
      )}
    </SettingsLayout>
  )
}
