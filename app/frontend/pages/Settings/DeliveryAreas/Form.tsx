import { Head, router, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import MoneyField from '@/components/ui/MoneyField'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'

type Props = {
  // null when adding; the area when editing.
  area: { id: number; name: string; fee: string; active: boolean; orders_count: number } | null
}

export default function DeliveryAreaForm({ area }: Props) {
  const editing = area !== null

  const form = useForm({
    name: area?.name ?? '',
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
    const kept = area.orders_count === 0 ? '' : ' Orders already sent there are kept, with their fee.'
    if (!(await confirmAction(`Delete "${area.name}"?${kept}`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/settings/areas/${area.id}`)
  }

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${area.name}` : 'Add an area'} />

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <h2 className="font-display text-3xl font-semibold text-wine-800">{editing ? `Edit ${area.name}` : 'Add an area'}</h2>

        <TextField
          id="name"
          label="Name"
          required
          maxLength={40}
          placeholder="e.g. East Legon"
          autoFocus={!editing}
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
            {editing ? 'Save changes' : 'Add area'}
          </Button>
          <ButtonLink href="/settings/areas" variant="secondary">
            Cancel
          </ButtonLink>
          {editing && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete area
            </Button>
          )}
        </div>
      </form>
    </SettingsLayout>
  )
}
