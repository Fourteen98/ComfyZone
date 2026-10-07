import { Head, Link } from '@inertiajs/react'
import { Plus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { formatMoney } from '@/lib/format'

// group: the region at home, the country abroad; null if not set yet.
type AreaRow = { id: number; name: string; group: string | null; fee_pesewas: number; active: boolean; orders_count: number }

// Props from Settings::DeliveryAreasController#index. The places arrive
// sorted by region then name; this groups them under a heading per region.
export default function DeliveryAreasIndex({ areas }: { areas: AreaRow[] }) {
  const orders = (count: number) => (count === 1 ? '1 order' : `${count} orders`)

  const groups = new Map<string, AreaRow[]>()
  for (const area of areas) {
    const region = area.group ?? 'No region yet'
    groups.set(region, [...(groups.get(region) ?? []), area])
  }

  return (
    <SettingsLayout>
      <Head title="Locations" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-taupe-700">
          The exact places within each region, and cities abroad. New ones are added by themselves when you type them on a sale or a
          customer. Come here to set the usual delivery fee for a place, fix a spelling, or hide one.
        </p>
        <ButtonLink href="/admin/settings/areas/new">
          <Plus className="size-5" aria-hidden="true" />
          Add a place
        </ButtonLink>
      </div>

      {areas.length === 0 && (
        <p className="mt-5 rounded-lg border border-taupe-200 bg-white px-5 py-6 text-taupe-700">
          No places yet. They will appear here as you record where your buyers are.
        </p>
      )}

      {[...groups].map(([region, places]) => (
        <section key={region} className="mt-6">
          <h2 className="font-display text-2xl font-semibold text-wine-800">{region}</h2>
          <ul className="mt-2 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
            {places.map((area) => (
              <li key={area.id}>
                <Link
                  href={`/admin/settings/areas/${area.id}/edit`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                >
                  <span className={`font-medium ${area.active ? '' : 'text-taupe-600'}`}>{area.name}</span>
                  <span className="text-sm text-taupe-700 tabular-nums">
                    {area.fee_pesewas > 0 ? `${formatMoney(area.fee_pesewas)} delivery` : 'No fee set'}
                  </span>
                  {!area.active && <Badge tone="muted">Hidden</Badge>}
                  <span className="ml-auto text-sm text-taupe-700 tabular-nums">{orders(area.orders_count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </SettingsLayout>
  )
}
