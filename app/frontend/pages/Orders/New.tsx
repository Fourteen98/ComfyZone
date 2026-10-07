import { Head, Link } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import SaleCapture from '@/components/SaleCapture'
import type { Buyer, SellableProduct } from '@/components/SaleCapture'
import type { SalesChannel } from '@/lib/orders'
import type { Locations } from '@/components/LocationFields'

// A sale made outside a live. The same capture screen, with no live attached.
type Props = { products: SellableProduct[]; buyers: Buyer[]; channels: SalesChannel[]; locations: Locations }

export default function OrderNew({ products, buyers, channels, locations }: Props) {
  return (
    <AppLayout>
      <Head title="Record a sale" />

      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Orders
      </Link>
      <div className="mt-2">
        <PageHeader title="Record a sale" description="For an order taken outside a live: WhatsApp, a call, someone at the door." />
      </div>

      <div className="mt-6">
        <SaleCapture products={products} buyers={buyers} channels={channels} locations={locations} />
      </div>
    </AppLayout>
  )
}
