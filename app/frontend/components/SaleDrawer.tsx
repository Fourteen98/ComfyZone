import { Link } from '@inertiajs/react'
import { FilePen } from 'lucide-react'
import SaleCapture from '@/components/SaleCapture'
import type { Buyer, SellableProduct } from '@/components/SaleCapture'
import Drawer, { DrawerLoading, loadDrawerData } from '@/components/ui/Drawer'
import type { Locations } from '@/components/LocationFields'
import type { SalesChannel } from '@/lib/orders'

// What Record a sale needs (OrdersController#sale_props).
export type SaleData = {
  products: SellableProduct[]
  buyers: Buyer[]
  channels: SalesChannel[]
  locations: Locations
  ways_to_pay: { value: string; label: string; reference?: boolean }[] | null
}

type Props = {
  open: boolean
  onClose: () => void
  /** null until the server has sent it (the first time the drawer opens). */
  data: SaleData | null
  /** Sales saved halfway: a link to finish them on the full page. */
  drafts: number
}

// "Record a sale" without leaving the orders list (see Drawer). The screen
// inside is the same SaleCapture as the full Record a sale page. Recording
// sends her back to this list (the drawer closes, the new order is on top);
// a mistake keeps the drawer open with the problem shown.
export default function SaleDrawer({ open, onClose, data, drafts }: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Record a sale"
      extra={
        drafts > 0 && (
          <Link
            href="/admin/orders/new"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-wine-800 hover:bg-taupe-100"
          >
            <FilePen className="size-4" aria-hidden="true" />
            {drafts === 1 ? '1 draft' : `${drafts} drafts`}
          </Link>
        )
      }
    >
      {data ? (
        <SaleCapture
          inDrawer
          products={data.products}
          buyers={data.buyers}
          channels={data.channels}
          locations={data.locations}
          waysToPay={data.ways_to_pay}
        />
      ) : (
        <DrawerLoading />
      )}
    </Drawer>
  )
}

// The sale drawer's data.
export const loadSale = (onLoaded: (data: SaleData | null) => void) => loadDrawerData<SaleData>('sale', onLoaded)
