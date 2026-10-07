import { Head, router, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'

type Props = {
  // null when adding; the method when editing.
  method: { id: number; name: string; wants_reference: boolean; active: boolean; used: boolean } | null
}

export default function PaymentMethodForm({ method }: Props) {
  const editing = method !== null

  const form = useForm({
    name: method?.name ?? '',
    wants_reference: method?.wants_reference ?? false,
    active: method?.active ?? true,
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ payment_method: data }))

    if (editing) {
      form.patch(`/settings/payments/${method.id}`)
    } else {
      form.post('/settings/payments')
    }
  }

  async function destroy() {
    if (!editing) return
    if (!(await confirmAction(`Delete "${method.name}"? It has never been used, so nothing else changes.`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/settings/payments/${method.id}`)
  }

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${method.name}` : 'Add a payment method'} />

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <h2 className="font-display text-3xl font-semibold text-wine-800">{editing ? `Edit ${method.name}` : 'Add a payment method'}</h2>

        <TextField
          id="name"
          label="Name"
          required
          maxLength={30}
          placeholder="e.g. Telecel Cash"
          autoFocus={!editing}
          value={form.data.name}
          onChange={(e) => {
            form.setData('name', e.target.value)
            form.clearErrors('name')
          }}
          error={errors.name}
        />

        <Checkbox
          label="Ask for a transaction ID"
          description="For methods that give one, like mobile money or a bank transfer."
          checked={form.data.wants_reference}
          onChange={(e) => form.setData('wants_reference', e.target.checked)}
        />

        {editing && (
          <Checkbox
            label="Offer this when recording money"
            description="Untick to hide it. Payments already made with it keep showing its name."
            checked={form.data.active}
            onChange={(e) => form.setData('active', e.target.checked)}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add method'}
          </Button>
          <ButtonLink href="/settings/payments" variant="secondary">
            Cancel
          </ButtonLink>
          {/* One that has been used can only be hidden: its payments must
              always be able to say how they were paid. */}
          {editing && !method.used && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete method
            </Button>
          )}
        </div>
        {editing && method.used && <p className="text-sm text-taupe-700">This method has been used, so it can be hidden but not deleted.</p>}
      </form>
    </SettingsLayout>
  )
}
