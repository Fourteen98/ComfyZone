import { Head, Link, router, useForm } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import PickAndOrder from '@/components/ui/PickAndOrder'
import SelectField from '@/components/ui/SelectField'
import type { Pick } from '@/components/ui/PickAndOrder'
import { confirmAction } from '@/lib/confirm'

// Props from DashboardController#edit (Dashboard#choices): everything this
// person is allowed to show, with what is switched on now, in their order.
// roles: only sent to people who manage roles (empty otherwise).
type Props = { tiles: Pick[]; panels: Pick[]; max_tiles: number; customised: boolean; roles: { value: number; label: string }[] }

export default function DashboardEdit({ tiles, panels, max_tiles, customised, roles }: Props) {
  const [roleId, setRoleId] = useState('')
  const form = useForm({ tiles, panels })

  function submit(event: FormEvent) {
    event.preventDefault()
    // Rails only needs the keys that are switched on, in order.
    const keys = (items: Pick[]) => items.filter((item) => item.on).map((item) => item.key)
    form.transform((data) => ({ dashboard: { tiles: keys(data.tiles), panels: keys(data.panels) } }))
    form.patch('/admin/dashboard') // -> DashboardController#update
  }

  // Save what is ticked here as the dashboard a whole role starts with.
  // Her own dashboard is not changed by this.
  function saveForRole() {
    const keys = (items: Pick[]) => items.filter((item) => item.on).map((item) => item.key)
    router.patch('/admin/dashboard', { role_id: roleId, dashboard: { tiles: keys(form.data.tiles), panels: keys(form.data.panels) } })
  }

  async function reset() {
    if (!(await confirmAction('Go back to the standard dashboard?', { confirm: 'Reset it' }))) return
    router.patch('/admin/dashboard', { reset: true })
  }

  return (
    <AppLayout>
      <Head title="Customise your dashboard" />

      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Dashboard
      </Link>
      <div className="mt-2">
        <PageHeader
          title="Customise your dashboard"
          description="Tick what you want to see and put it in order. This only changes your own dashboard."
        />
      </div>

      <form onSubmit={submit} className="mt-6 max-w-5xl">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <PickAndOrder
            legend="Numbers at the top"
            hint="The headline figures, left to right."
            items={form.data.tiles}
            onChange={(items) => form.setData('tiles', items)}
            max={max_tiles}
          />
          <PickAndOrder
            legend="Panels"
            hint="The lists and charts underneath, top to bottom."
            items={form.data.panels}
            onChange={(items) => form.setData('panels', items)}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={form.processing}>
            Save dashboard
          </Button>
          <ButtonLink href="/admin" variant="secondary">
            Cancel
          </ButtonLink>
          {customised && (
            <Button type="button" variant="secondary" className="sm:ml-auto" onClick={reset}>
              Back to the standard layout
            </Button>
          )}
        </div>

        {roles.length > 0 && (
          <section className="mt-10 max-w-xl rounded-lg border border-taupe-200 bg-white p-5">
            <h2 className="font-display text-2xl font-semibold text-wine-800">Set it for a whole role</h2>
            <p className="mt-1 mb-4 text-taupe-700">
              Make what is ticked above the dashboard everyone in a role starts with. Anything that role isn't allowed to
              see is left out, and people who have customised their own keep theirs.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <SelectField id="role_id" label="Role" placeholder="Choose a role" options={roles} value={roleId} onChange={(e) => setRoleId(e.target.value)} />
              </div>
              <Button type="button" variant="secondary" disabled={roleId === ''} onClick={saveForRole}>
                Save as their standard
              </Button>
            </div>
          </section>
        )}
      </form>
    </AppLayout>
  )
}
