import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import TextAreaField from '@/components/ui/TextAreaField'
import TextField from '@/components/ui/TextField'
import LocationFields from '@/components/LocationFields'
import type { Locations } from '@/components/LocationFields'
import ProductMultiPicker from '@/components/ProductMultiPicker'
import type { PickableProduct } from '@/components/ProductMultiPicker'

type Props = {
  // null when adding; the supplier when editing.
  supplier: {
    id: number
    name: string
    phone: string
    note: string
    location: string // market, street, shop number
    country: string
    region: string
    place: string
    product_ids: number[]
  } | null
  products: PickableProduct[]
  locations: Locations
}

export default function SupplierForm({ supplier, products, locations }: Props) {
  const editing = supplier !== null

  const form = useForm({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    note: supplier?.note ?? '',
    location: supplier?.location ?? '',
    country: supplier?.country ?? locations.home,
    region: supplier?.region ?? '',
    place: supplier?.place ?? '',
    product_ids: supplier?.product_ids ?? ([] as number[]),
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    // An empty list is sent as [""] so Rails still receives the key and
    // knows to clear the products, instead of leaving them untouched.
    form.transform((data) => ({
      supplier: { ...data, product_ids: data.product_ids.length ? data.product_ids : [''] },
    }))

    if (editing) {
      form.patch(`/admin/suppliers/${supplier.id}`) // -> SuppliersController#update
    } else {
      form.post('/admin/suppliers') // -> SuppliersController#create
    }
  }

  return (
    <AppLayout>
      <Head title={editing ? `Edit ${supplier.name}` : 'Add a supplier'} />
      <PageHeader title={editing ? `Edit ${supplier.name}` : 'Add a supplier'} />

      <form onSubmit={submit} className="mt-6 max-w-3xl space-y-6">
        <Panel title="Who they are">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id="name"
                label="Name"
                required
                maxLength={60}
                placeholder="Person or shop"
                autoFocus={!editing}
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
                error={errors.name}
              />
              <TextField
                id="phone"
                label="Phone number"
                type="tel"
                required
                maxLength={25}
                placeholder="e.g. 024 123 4567"
                value={form.data.phone}
                onChange={(e) => form.setData('phone', e.target.value)}
                error={errors.phone}
              />
            </div>
            {/* Where they are. A supplier abroad has a country and a city;
                one at home has a region and a place. */}
            <LocationFields value={form.data} locations={locations} onChange={(where) => form.setData({ ...form.data, ...where })} errors={errors} />
            <TextField
              id="location"
              label="Address (optional)"
              maxLength={80}
              placeholder="Market, street or shop number"
              value={form.data.location}
              onChange={(e) => form.setData('location', e.target.value)}
              error={errors.location}
            />
            <TextAreaField
              id="note"
              label="Notes (optional)"
              maxLength={500}
              placeholder="Where they are, how they like to be paid, how long delivery takes."
              value={form.data.note}
              onChange={(e) => form.setData('note', e.target.value)}
              error={errors.note}
            />
          </div>
        </Panel>

        <Panel title="What they sell">
          <p className="mb-4 text-taupe-700">
            Choose the products you get from them. Anything you later buy from them is added here for you.
          </p>
          <ProductMultiPicker
            label={form.data.product_ids.length === 1 ? '1 product chosen' : `${form.data.product_ids.length} products chosen`}
            products={products}
            value={form.data.product_ids}
            onChange={(ids) => form.setData('product_ids', ids)}
          />
        </Panel>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add supplier'}
          </Button>
          <ButtonLink href={editing ? `/admin/suppliers/${supplier.id}` : '/admin/suppliers'} variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </AppLayout>
  )
}
