import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import TextAreaField from '@/components/ui/TextAreaField'
import TextField from '@/components/ui/TextField'

type Props = {
  customer: { id: number; handle: string; name: string; phone: string; location: string; note: string } | null
}

export default function CustomerForm({ customer }: Props) {
  const editing = customer !== null

  const form = useForm({
    handle: customer?.handle ?? '',
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    location: customer?.location ?? '',
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
        <TextField
          id="location"
          label="Where they are"
          maxLength={80}
          placeholder="Area or town, for delivery"
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
    </AppLayout>
  )
}
