import { Head } from '@inertiajs/react'
import { Check, Shirt } from 'lucide-react'
import ShopLayout from '@/layouts/ShopLayout'
import { ButtonLink } from '@/components/ui/Button'
import { formatMoney } from '@/lib/format'

type Status = 'claimed' | 'paid' | 'packed' | 'delivered' | 'cancelled' | 'returned'

type Props = {
  order: {
    number: number
    placed: string
    status: Status
    name: string | null
    delivery_method: 'pickup' | 'delivery' | null
    delivery_address: string | null
    delivery_fee_pesewas: number
    fee_to_confirm: boolean
    total_pesewas: number
    due_pesewas: number
    paid_pesewas: number
    balance_pesewas: number
    items: { name: string; option_values: { label: string }[]; quantity: number; total_pesewas: number; thumb_url: string | null }[]
  }
}

// Where the order has got to, in the shopper's words. The back office's
// stages (claimed, paid, packed...) are the same facts, named for staff.
const steps = (pickup: boolean) => ['Order received', 'Being prepared', pickup ? 'Collected' : 'Delivered']
const reached: Record<Status, number> = { claimed: 0, paid: 0, packed: 1, delivered: 2, cancelled: -1, returned: -1 }

// Props from Shop::OrdersController#show. This page is the receipt AND the
// tracker: the link works for as long as they keep it.
export default function ShopOrder({ order }: Props) {
  const pickup = order.delivery_method === 'pickup'
  const at = reached[order.status]
  const stopped = at === -1

  return (
    <ShopLayout>
      <Head title={`Order ${order.number}`} />

      <div className="mt-10 text-center">
        <p className="text-xs tracking-[0.3em] text-taupe-600 uppercase">Order {order.number}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-balance text-wine-800 sm:text-5xl">
          {stopped
            ? order.status === 'cancelled'
              ? 'This order was cancelled'
              : 'This order was returned'
            : at === 2
              ? 'Enjoy your pieces'
              : `Thank you${order.name ? `, ${order.name.split(' ')[0]}` : ''}`}
        </h1>
        {!stopped && at < 2 && (
          <p className="mx-auto mt-3 max-w-md text-taupe-800">
            Your pieces are held for you. We will call or WhatsApp you shortly to confirm{pickup ? ' when to collect' : ' delivery'} and payment.
          </p>
        )}
        <p className="mt-2 text-sm text-taupe-600">Placed {order.placed}. Keep this page's link to check on it.</p>
      </div>

      {!stopped && (
        <ol className="mx-auto mt-8 flex max-w-md items-start">
          {steps(pickup).map((label, index) => (
            <li key={label} className="flex flex-1 flex-col items-center text-center" aria-current={index === at ? 'step' : undefined}>
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${index === 0 ? 'invisible' : index <= at ? 'bg-wine-800' : 'bg-taupe-300'}`} />
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                    index <= at ? 'bg-wine-800 text-white' : 'border border-taupe-300 bg-white text-taupe-600'
                  }`}
                >
                  {index <= at ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className={`h-0.5 flex-1 ${index === 2 ? 'invisible' : index < at ? 'bg-wine-800' : 'bg-taupe-300'}`} />
              </div>
              <span className={`mt-2 px-1 text-sm text-balance ${index <= at ? 'font-medium text-wine-800' : 'text-taupe-600'}`}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-10 rounded-2xl border border-taupe-200 bg-white p-5 sm:p-6">
        <ul className="space-y-4">
          {order.items.map((item, index) => (
            <li key={index} className="flex items-center gap-4">
              <span className="block aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg bg-taupe-200">
                {item.thumb_url ? (
                  <img src={item.thumb_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-taupe-400">
                    <Shirt className="size-5" aria-hidden="true" />
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-taupe-700">
                  {[...item.option_values.map((value) => value.label), `Quantity ${item.quantity}`].join(', ')}
                </p>
              </div>
              <p className="tabular-nums">{formatMoney(item.total_pesewas)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-2 border-t border-taupe-200 pt-4 tabular-nums">
          <div className="flex justify-between">
            <dt className="text-taupe-800">{pickup ? 'Collecting it yourself' : 'Delivery'}</dt>
            <dd>{pickup ? 'Free' : order.fee_to_confirm ? 'To be confirmed' : formatMoney(order.delivery_fee_pesewas)}</dd>
          </div>
          {!pickup && order.delivery_address && <p className="text-sm text-taupe-700">To: {order.delivery_address}</p>}
          <div className="flex items-baseline justify-between pt-2">
            <dt className="font-medium">Total{order.fee_to_confirm ? ', before delivery' : ''}</dt>
            <dd className="text-2xl font-semibold text-wine-800">{formatMoney(order.due_pesewas)}</dd>
          </div>
          {order.paid_pesewas > 0 && (
            <div className="flex justify-between text-emerald-800">
              <dt>Paid</dt>
              <dd>{formatMoney(order.paid_pesewas)}</dd>
            </div>
          )}
          {!stopped && order.balance_pesewas > 0 && order.paid_pesewas > 0 && (
            <div className="flex justify-between">
              <dt className="text-taupe-800">Still to pay</dt>
              <dd>{formatMoney(order.balance_pesewas)}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="mt-8 flex justify-center">
        <ButtonLink href="/" variant="secondary">
          Back to the shop
        </ButtonLink>
      </div>
    </ShopLayout>
  )
}
