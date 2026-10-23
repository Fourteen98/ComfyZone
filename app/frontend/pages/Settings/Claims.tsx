import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Button from '@/components/ui/Button'
import Panel from '@/components/ui/Panel'
import TextField from '@/components/ui/TextField'

// Props from Settings::ClaimsController#show. Hours as text: "" = no deadline.
type Props = {
  setting: { live_pay_hours: string; sale_pay_hours: string; remind_hours: string }
  running: number // unpaid claims on the clock right now
  released: number // released for not paying, last 30 days
}

const hoursOnly = (text: string) => text.replace(/\D/g, '').slice(0, 3)

// How long an unpaid claim keeps its items before they go back on sale.
export default function ClaimSettings({ setting, running, released }: Props) {
  const form = useForm({ ...setting })
  const errors = form.errors as Record<string, string | string[] | undefined>

  function save(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ claims: data }))
    form.patch('/admin/settings/claims', { preserveScroll: true }) // -> Settings::ClaimsController#update
  }

  // "24" -> "1 day", "36" -> "1 day 12 hours"
  const words = (text: string) => {
    const hours = Number.parseInt(text, 10)
    if (!hours) return 'No deadline: claims keep their items until you decide.'
    const days = Math.floor(hours / 24)
    const rest = hours % 24
    return `${[days && `${days} ${days === 1 ? 'day' : 'days'}`, rest && `${rest} ${rest === 1 ? 'hour' : 'hours'}`].filter(Boolean).join(' ')} to pay.`
  }

  return (
    <SettingsLayout>
      <Head title="Unpaid claims" />
      <p className="max-w-2xl text-taupe-700">
        Someone claims a dress on a live and never pays: the dress sits out of stock for nothing. Give claims a time to pay. When the time
        runs out the order is released, everything on it goes back on sale, people on the waiting list are told, and the customer's record
        shows it wasn't paid.
      </p>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Time to pay">
          <form onSubmit={save} className="space-y-5">
            <div className="max-w-xs">
              <TextField
                id="live_pay_hours"
                label="Claims from a live, in hours"
                inputMode="numeric"
                placeholder="No deadline"
                value={form.data.live_pay_hours}
                onChange={(e) => form.setData('live_pay_hours', hoursOnly(e.target.value))}
                error={errors.live_pay_hours}
              />
              <p className="mt-1.5 text-sm text-taupe-700">{words(form.data.live_pay_hours)}</p>
            </div>
            <div className="max-w-xs">
              <TextField
                id="sale_pay_hours"
                label="Sales you record by hand, in hours"
                inputMode="numeric"
                placeholder="No deadline"
                value={form.data.sale_pay_hours}
                onChange={(e) => form.setData('sale_pay_hours', hoursOnly(e.target.value))}
                error={errors.sale_pay_hours}
              />
              <p className="mt-1.5 text-sm text-taupe-700">{words(form.data.sale_pay_hours)}</p>
            </div>
            <div className="max-w-xs">
              <TextField
                id="remind_hours"
                label="Warn me this many hours before"
                inputMode="numeric"
                value={form.data.remind_hours}
                onChange={(e) => form.setData('remind_hours', hoursOnly(e.target.value))}
                error={errors.remind_hours}
              />
              <p className="mt-1.5 text-sm text-taupe-700">
                A notification lists who still hasn't paid, so you can remind them. Turn on "Unpaid claims" under My account →
                Notifications.
              </p>
            </div>
            <Button type="submit" disabled={form.processing}>
              Save
            </Button>
          </form>
        </Panel>

        <Panel title="How it works">
          <ul className="list-disc space-y-2 pl-5 text-taupe-800">
            <li>The clock starts when the claim is made. Leave a box empty for no deadline.</li>
            <li>Any payment, even part, stops the clock. So does a WhatsApp customer saying "I've paid".</li>
            <li>On an order you can give one more day, take the deadline off, remind them on WhatsApp, or release it yourself.</li>
            <li>WhatsApp reservations keep their own, shorter time (Settings → WhatsApp).</li>
            <li>Changing these times only affects new claims.</li>
          </ul>
          <p className="mt-4 text-taupe-700 tabular-nums">
            Now: {running} unpaid {running === 1 ? 'claim' : 'claims'} on the clock. Released for not paying in the last 30 days: {released}
            .
          </p>
        </Panel>
      </div>
    </SettingsLayout>
  )
}
