import { Head, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import PageHeader from '@/components/ui/PageHeader'
import BuyerPicker from '@/components/BuyerPicker'
import type { Buyer } from '@/components/BuyerPicker'
import Panel from '@/components/ui/Panel'
import { confirmAction } from '@/lib/confirm'
import LocationFields from '@/components/LocationFields'
import type { Locations } from '@/components/LocationFields'
import TextAreaField from '@/components/ui/TextAreaField'
import TextField from '@/components/ui/TextField'
import PhoneField from '@/components/ui/PhoneField'

type Props = {
  customer: {
    id: number
    handle: string
    name: string
    phone: string
    location: string
    note: string
    bulk_buyer: boolean
    country: string
    region: string
    place: string
  } | null
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
    if (sure) router.post(`/admin/customers/${customer.id}/merge`, { other_id: twin.id }) // -> CustomersController#merge
  }

  const editing = customer !== null

  const form = useForm({
    handle: customer?.handle ?? '',
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    location: customer?.location ?? '',
    country: customer?.country ?? locations.home,
    region: customer?.region ?? '',
    place: customer?.place ?? '',
    note: customer?.note ?? '',
    bulk_buyer: customer?.bulk_buyer ?? false,
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ customer: data }))

    if (editing) {
      form.patch(`/admin/customers/${customer.id}`)
    } else {
      form.post('/admin/customers')
    }
  }

  return (
    <AppLayout>
      <Head title={editing ? 'Edit customer' : 'Add a customer'} />
      <PageHeader
        title={editing ? 'Edit customer' : 'Add a customer'}
        description="Fill in what you know. At least one of the first three."
      />

      <form onSubmit={submit} className="mt-6 max-w-xl space-y-5">
        {errors.base && <Alert tone="error">{errors.base[0]}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="name"
            label="Name"
            maxLength={60}
            value={form.data.name}
            onChange={(e) => form.setData('name', e.target.value)}
            error={errors.name}
          />
          {/* The number is how a customer is recognised: one number, one customer. */}
          <PhoneField
            id="phone"
            label="Phone number"
            value={form.data.phone}
            onChange={(phone) => form.setData('phone', phone)}
            error={errors.phone}
            hint="One number per customer. It is how they are recognised next time."
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
        <LocationFields
          value={form.data}
          locations={locations}
          onChange={(where) => form.setData({ ...form.data, ...where })}
          errors={errors}
        />
        <TextField
          id="location"
          label="Address or landmark"
          maxLength={80}
          placeholder="Street or landmark, for the rider"
          value={form.data.location}
          onChange={(e) => form.setData('location', e.target.value)}
          error={errors.location}
        />
        <TextAreaField
          id="note"
          label="Notes (optional)"
          maxLength={500}
          value={form.data.note}
          onChange={(e) => form.setData('note', e.target.value)}
          error={errors.note}
        />
        <Checkbox
          label="Bulk buyer"
          description="Always gets the bulk price on products that have one, however many they take. For resellers and regular wholesale customers."
          checked={form.data.bulk_buyer}
          onChange={(e) => form.setData('bulk_buyer', e.target.checked)}
        />

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add customer'}
          </Button>
          <ButtonLink href="/admin/customers" variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </form>

      {/* ---------- The same person, entered twice ---------- */}
      {editing && others.length > 0 && (
        <div className="mt-10 max-w-xl">
          <Panel title="Entered twice?">
            <p className="mb-4 text-taupe-700">
              If this person is also in your customers under another name, find the other one here and merge them into this one.
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
