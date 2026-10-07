import { Head, Link, router } from '@inertiajs/react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { formatMoney } from '@/lib/format'

type AreaRow = { id: number; name: string; fee_pesewas: number; active: boolean; orders_count: number }

const arrow =
  'flex size-10 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100 hover:text-wine-800 focus-visible:outline-2 focus-visible:outline-wine-700 disabled:opacity-30 disabled:hover:bg-transparent'

// Props from Settings::DeliveryAreasController#index
export default function DeliveryAreasIndex({ areas }: { areas: AreaRow[] }) {
  const orders = (count: number) => (count === 1 ? '1 order' : `${count} orders`)

  // -> Settings::DeliveryAreasController#move
  const move = (area: AreaRow, direction: 'up' | 'down') =>
    router.patch(`/settings/areas/${area.id}/move`, { direction }, { preserveScroll: true })

  return (
    <SettingsLayout>
      <Head title="Delivery areas" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-taupe-700">
          The places you deliver to, each with its usual fee. Picking one on an order fills in the fee, which you can
          still change for that order. They show in this order.
        </p>
        <ButtonLink href="/settings/areas/new">
          <Plus className="size-5" aria-hidden="true" />
          Add an area
        </ButtonLink>
      </div>

      {areas.length === 0 ? (
        <p className="mt-5 rounded-lg border border-taupe-200 bg-white px-5 py-6 text-taupe-700">
          No areas yet. Until you add some, you type the delivery fee by hand on each order.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
          {areas.map((area, index) => (
            <li key={area.id} className="flex items-center gap-1 pr-2">
              <Link
                href={`/settings/areas/${area.id}/edit`}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
              >
                <span className={`font-medium ${area.active ? '' : 'text-taupe-600'}`}>{area.name}</span>
                <span className="text-sm text-taupe-700 tabular-nums">
                  {area.fee_pesewas > 0 ? formatMoney(area.fee_pesewas) : 'Free'}
                </span>
                {!area.active && <Badge tone="muted">Hidden</Badge>}
                <span className="ml-auto text-sm text-taupe-700 tabular-nums">{orders(area.orders_count)}</span>
              </Link>
              <button type="button" className={arrow} onClick={() => move(area, 'up')} disabled={index === 0} aria-label={`Move ${area.name} up`}>
                <ArrowUp className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={arrow}
                onClick={() => move(area, 'down')}
                disabled={index === areas.length - 1}
                aria-label={`Move ${area.name} down`}
              >
                <ArrowDown className="size-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsLayout>
  )
}
