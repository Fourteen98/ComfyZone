import { Head, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import BuyerPicker from '@/components/BuyerPicker'
import type { Buyer } from '@/components/BuyerPicker'
import Panel from '@/components/ui/Panel'
import { confirmAction } from '@/lib/confirm'
import LocationFields from '@/components/LocationFields'
import type { Locations } from '@/components/LocationFields'
import TextAreaField from '@/components/ui/TextAreaField'
import TextField from '@/components/ui/TextField'

type Props = {
  customer: { id: number; handle: string; name: string; phone: string; location: string; note: string; region: string; place: string } | null
  locations: Locations
  // Editing only: everyone else, and how many orders this customer has.
  others?: Buyer[]
  orders_count?: number
}

export default function CustomerForm({ customer, locations, others = [] }: Props) {
  const [twin, setTwin] = useState<{ id: number; label: string } | null>(null)

  async function merge() {
    if (!customer || !twin) return
    const sure = await confirmAction(
      `Merge ${twin.label} into this customer? Their orders move here, anything missing here is copied across, and ${twin.label} is removed. This can't be undone.`,
      { confirm: 'Merge them' },
    )
    if (sure) router.post(`/customers/${customer.id}/merge`, { other_id: twin.id }) // -> CustomersController#merge
  }

  const editing = customer !== null

  const form = useForm({
    handle: customer?.handle ?? '',
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    location: customer?.location ?? '',
    region: customer?.region ?? '',
    place: customer?.place ?? '',
    note: customer?.note ?? '',
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ customer: data }))

    if (editing) {
      form.patch(`/customers/${customer.id}`)
    } else {
      form.post('/customers')
    }
  }

  return (
    <AppLayout>
      <Head title={editing ? 'Edit customer' : 'Add a customer'} />
      <PageHeader title={editing ? 'Edit customer' : 'Add a customer'} description="Fill in what you know. At least one of the first three." />

      <form onSubmit={submit} className="mt-6 max-w-xl space-y-5">
        {errors.base && <Alert tone="error">{errors.base[0]}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="name" label="Name" maxLength={60} value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={errors.name} />
          <TextField
            id="phone"
            label="Phone number"
            type="tel"
            maxLength={25}
            placeholder="e.g. 024 123 4567"
            value={form.data.phone}
            onChange={(e) => form.setData('phone', e.target.value)}
            error={errors.phone}
          />
        </div>
        <TextField
          id="handle"
          label="Username"
          maxLength={40}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="On TikTok, Instagram... without the @"
          value={form.data.handle}
          onChange={(e) => form.setData('handle', e.target.value)}
          error={errors.handle}
        />
        <LocationFields value={form.data} locations={locations} onChange={(where) => form.setData({ ...form.data, ...where })} errors={errors} />
        <TextField
          id="location"
          label="Address or landmark"
          maxLength={80}
          placeholder="Street or landmark, for the rider"
          value={form.data.location}
          onChange={(e) => form.setData('location', e.target.value)}
          error={errors.location}
        />
        <TextAreaField id="note" label="Notes (optional)" maxLength={500} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} error={errors.note} />

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add customer'}
          </Button>
          <ButtonLink href="/customers" variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </form>

      {/* ---------- The same person, entered twice ---------- */}
      {editing && others.length > 0 && (
        <div className="mt-10 max-w-xl">
          <Panel title="Entered twice?">
            <p className="mb-4 text-taupe-700">
              If this person is also in your customers under another name, find the other one here and merge them into
              this one.
            </p>
            <BuyerPicker
              buyers={others}
              usernameFirst={false}
              searchOnly
              onChange={(choice, label) => setTwin(choice && 'id' in choice ? { id: choice.id, label } : null)}
            />
            {twin && (
              <Button type="button" variant="secondary" className="mt-4" onClick={merge}>
                Merge {twin.label} into this customer
              </Button>
            )}
          </Panel>
        </div>
      )}
    </AppLayout>
  )
}
