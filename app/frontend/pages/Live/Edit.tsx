import { Head, Link, router, useForm } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import PageHeader from '@/components/ui/PageHeader'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'
import type { SalesChannel } from '@/lib/orders'

// Props from LiveSessionsController#edit
type Props = {
  live: { id: number; title: string; sales_channel_id: string; orders: number }
  channels: SalesChannel[]
}

export default function LiveEdit({ live, channels }: Props) {
  const form = useForm({ title: live.title, sales_channel_id: live.sales_channel_id })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ live: data }))
    form.patch(`/live/${live.id}`) // -> LiveSessionsController#update
  }

  async function destroy() {
    if (!(await confirmAction(`Delete "${live.title}"? Nothing was sold on it, so nothing else changes.`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/live/${live.id}`)
  }

  return (
    <AppLayout>
      <Head title={`Edit ${live.title}`} />

      <Link href={`/live/${live.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the live
      </Link>
      <div className="mt-2">
        <PageHeader title="Edit live" />
      </div>

      <form onSubmit={submit} className="mt-6 max-w-xl space-y-5">
        <TextField
          id="title"
          label="Name"
          required
          maxLength={60}
          value={form.data.title}
          onChange={(e) => {
            form.setData('title', e.target.value)
            form.clearErrors('title')
          }}
          error={errors.title}
        />

        {channels.length > 1 && (
          <div>
            <ChoicePills
              legend="Where was it?"
              name="sales_channel_id"
              choices={channels.map((channel) => ({ value: String(channel.id), label: channel.name }))}
              value={form.data.sales_channel_id}
              onChange={(id) => form.setData('sales_channel_id', id)}
              error={errors.sales_channel}
            />
            {live.orders > 0 && (
              <p className="mt-2 text-sm text-taupe-700">
                Changing this also changes where its {live.orders === 1 ? 'order is' : `${live.orders} orders are`} counted in your
                reports.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            Save changes
          </Button>
          <ButtonLink href={`/live/${live.id}`} variant="secondary">
            Cancel
          </ButtonLink>
          {/* Only a live nothing was sold on can go. */}
          {live.orders === 0 && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete live
            </Button>
          )}
        </div>
      </form>
    </AppLayout>
  )
}
