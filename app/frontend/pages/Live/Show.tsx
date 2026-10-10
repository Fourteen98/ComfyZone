import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import StatStrip from '@/components/ui/StatStrip'
import OrderList from '@/components/OrderList'
import SaleCapture from '@/components/SaleCapture'
import type { Buyer, SellableProduct } from '@/components/SaleCapture'
import { formatMoney } from '@/lib/format'
import type { OrderSummary } from '@/lib/orders'
import { confirmAction } from '@/lib/confirm'
import type { Locations } from '@/components/LocationFields'

type Props = {
  live: {
    id: number
    title: string
    channel: string | null // the platform, e.g. "TikTok"
    running: boolean
    started_at: string // ISO 8601
    started: string
    ended: string | null
    minutes: number | null
  }
  stats: { orders: number; units: number; total_pesewas: number; profit_pesewas: number | null; expenses_pesewas: number | null }
  orders: OrderSummary[]
  can_sell: boolean
  // After the live: is the claim screen open again for a missed order?
  adding: boolean
  // Only sent while claims can be recorded, to people who can sell.
  products?: SellableProduct[]
  buyers?: Buyer[]
  locations?: Locations // countries, regions and known places
}

// How long the live has been on, updating by itself.
function useMinutesSince(iso: string, running: boolean) {
  const since = () => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  const [minutes, setMinutes] = useState(since)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setMinutes(since()), 20000)
    return () => clearInterval(timer) // stop ticking when she leaves the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, running])

  return minutes
}

// Props from LiveSessionsController#show
export default function LiveShow({ live, stats, orders, can_sell, adding, products, buyers, locations }: Props) {
  const minutes = useMinutesSince(live.started_at, live.running)
  const duration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)

  async function finish() {
    if (!(await confirmAction('End this live? You can still record sales afterwards, but they will not count towards it.', { confirm: 'End the live' }))) return
    router.patch(`/admin/live/${live.id}/finish`) // -> LiveSessionsController#finish
  }

  const strip = [
    { label: 'Orders', value: String(stats.orders) },
    { label: 'Items', value: String(stats.units) },
    { label: 'Sold', value: formatMoney(stats.total_pesewas) },
    // Profit on the goods, less any costs pinned to this live (Expenses).
    ...(stats.profit_pesewas !== null
      ? [
          {
            label: stats.expenses_pesewas ? 'Profit after live costs' : 'Profit',
            value: formatMoney(stats.profit_pesewas - (stats.expenses_pesewas ?? 0)),
            hint: stats.expenses_pesewas ? `${formatMoney(stats.expenses_pesewas)} live costs taken off` : undefined,
          },
        ]
      : []),
  ]

  return (
    <AppLayout>
      <Head title={live.title} />

      {!live.running && (
        <Link href="/admin/live" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Live sales
        </Link>
      )}

      <PageHeader
        title={live.title}
        description={
          live.running
            ? `Live for ${duration(minutes)}.`
            : `${live.started} to ${live.ended}, ${duration(live.minutes ?? 0)}.`
        }
        actions={
          can_sell && (
            <>
              <ButtonLink href={`/admin/live/${live.id}/edit`} variant="secondary">
                <Pencil className="size-5" aria-hidden="true" />
                Edit
              </ButtonLink>
              {live.running && (
                <Button type="button" variant="secondary" onClick={finish}>
                  End the live
                </Button>
              )}
            </>
          )
        }
      />

      <div className="mt-5">
        <StatStrip stats={strip} />
      </div>

      {/* A live that has ended can still be given an order that was missed.
          The link reloads this page with ?add=1, and Rails then sends the
          products and buyers the claim screen needs. */}
      {!live.running && can_sell && !adding && (
        <div className="mt-5">
          <ButtonLink href={`/admin/live/${live.id}`} data={{ add: 1 }} variant="secondary" preserveScroll>
            <Plus className="size-5" aria-hidden="true" />
            Add a missed order
          </ButtonLink>
        </div>
      )}
      {adding && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-wine-200 bg-wine-50 px-5 py-3">
          <p className="text-taupe-800">Adding to a live that has ended. Orders are dated {live.started}.</p>
          <ButtonLink href={`/admin/live/${live.id}`} variant="secondary">
            Done
          </ButtonLink>
        </div>
      )}

      {(live.running || adding) && can_sell && products && buyers && (
        <div className="mt-6">
          <SaleCapture products={products} buyers={buyers} liveId={live.id} liveChannel={live.channel} locations={locations} />
        </div>
      )}

      <div className="mt-6">
        <Panel title={live.running || adding ? 'Claims so far' : 'What was sold'}>
          {orders.length === 0 ? (
            <p className="text-taupe-700">{live.running ? 'Nothing claimed yet.' : 'Nothing was sold in this live.'}</p>
          ) : (
            <div className="-mx-5 -my-5">
              <OrderList orders={orders} removable={can_sell} showStatus={!live.running} />
            </div>
          )}
        </Panel>
      </div>
    </AppLayout>
  )
}
