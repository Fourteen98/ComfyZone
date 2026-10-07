import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, Pencil } from 'lucide-react'
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
  stats: { orders: number; units: number; total_pesewas: number; profit_pesewas: number | null }
  orders: OrderSummary[]
  can_sell: boolean
  // Only sent while the live is running, to people who can sell.
  products?: SellableProduct[]
  buyers?: Buyer[]
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
export default function LiveShow({ live, stats, orders, can_sell, products, buyers }: Props) {
  const minutes = useMinutesSince(live.started_at, live.running)
  const duration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)

  async function finish() {
    if (!(await confirmAction('End this live? You can still record sales afterwards, but they will not count towards it.', { confirm: 'End the live' }))) return
    router.patch(`/live/${live.id}/finish`) // -> LiveSessionsController#finish
  }

  const strip = [
    { label: 'Orders', value: String(stats.orders) },
    { label: 'Items', value: String(stats.units) },
    { label: 'Sold', value: formatMoney(stats.total_pesewas) },
    ...(stats.profit_pesewas !== null ? [{ label: 'Profit', value: formatMoney(stats.profit_pesewas) }] : []),
  ]

  return (
    <AppLayout>
      <Head title={live.title} />

      {!live.running && (
        <Link href="/live" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
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
              <ButtonLink href={`/live/${live.id}/edit`} variant="secondary">
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

      {live.running && can_sell && products && buyers && (
        <div className="mt-6">
          <SaleCapture products={products} buyers={buyers} liveId={live.id} liveChannel={live.channel} />
        </div>
      )}

      <div className="mt-6">
        <Panel title={live.running ? 'Claims so far' : 'What was sold'}>
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
