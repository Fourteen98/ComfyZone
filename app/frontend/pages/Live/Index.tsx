import { Head, Link, useForm } from '@inertiajs/react'
import { Radio } from 'lucide-react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import TextField from '@/components/ui/TextField'
import type { SalesChannel } from '@/lib/orders'
import { formatMoney } from '@/lib/format'

type PastLive = { id: number; title: string; started: string; minutes: number; orders: number; total_pesewas: number }

// Props from LiveSessionsController#index. Only shown when no live is running;
// if one is, Rails sends her straight to it.
type Props = { lives: PastLive[]; channels: SalesChannel[]; default_channel_id: number | null; can_start: boolean }

export default function LiveIndex({ lives, channels, default_channel_id, can_start }: Props) {
  const form = useForm({ title: '', sales_channel_id: default_channel_id ? String(default_channel_id) : '' })

  function start(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ live: data }))
    form.post('/admin/live') // -> LiveSessionsController#create
  }

  return (
    <AppLayout>
      <Head title="Live sales" />
      <PageHeader title="Live sales" description="Start a live, then tap what people claim. Stock drops as you go." />

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        {can_start && (
          <form onSubmit={start} className="rounded-lg bg-wine-800 p-6 text-taupe-50">
            <Radio className="size-9" aria-hidden="true" />
            <h2 className="mt-3 font-display text-3xl font-semibold">Going live?</h2>
            <p className="mt-1 text-taupe-200">Everything you sell is counted under this live, so you can see how it did.</p>

            <div className="mt-5 [&_label]:text-taupe-200">
              <TextField
                id="title"
                label="Name it (optional)"
                maxLength={60}
                placeholder="e.g. Friday new arrivals"
                value={form.data.title}
                onChange={(e) => form.setData('title', e.target.value)}
              />
            </div>
            {/* Only worth asking when there is more than one place to go live. */}
            {channels.length > 1 && (
              <div className="mt-4">
                <ChoicePills
                  inverted
                  legend="Where are you going live?"
                  name="sales_channel_id"
                  choices={channels.map((channel) => ({ value: String(channel.id), label: channel.name }))}
                  value={form.data.sales_channel_id}
                  onChange={(id) => form.setData('sales_channel_id', id)}
                />
              </div>
            )}
            <Button type="submit" block disabled={form.processing} className="mt-4 bg-taupe-50! text-wine-800! hover:bg-white!">
              Start the live
            </Button>
            <p className="mt-4 text-sm text-taupe-200">
              Selling without a live?{' '}
              <Link href="/admin/orders/new" className="font-medium text-taupe-50 underline underline-offset-4">
                Record a sale
              </Link>
            </p>
          </form>
        )}

        <Panel title="Past lives" className={can_start ? 'xl:col-span-2' : 'xl:col-span-3'}>
          {lives.length === 0 ? (
            <p className="text-taupe-700">Your lives will be listed here with what each one sold.</p>
          ) : (
            <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
              {lives.map((live) => (
                <li key={live.id}>
                  <Link href={`/admin/live/${live.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 hover:bg-taupe-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{live.title}</span>
                      <span className="block text-sm text-taupe-700">
                        {live.started}, {live.minutes} min
                      </span>
                    </span>
                    <span className="text-sm text-taupe-700 tabular-nums">{live.orders === 1 ? '1 order' : `${live.orders} orders`}</span>
                    <span className="w-32 text-right font-semibold tabular-nums">{formatMoney(live.total_pesewas)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppLayout>
  )
}
