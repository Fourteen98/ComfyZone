import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, Pencil, Phone, X } from 'lucide-react'
import { useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import ChoiceCards from '@/components/ui/ChoiceCards'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import QuantityStepper from '@/components/ui/QuantityStepper'
import Steps from '@/components/ui/Steps'
import OrderDeliveryForm from '@/components/OrderDeliveryForm'
import type { Delivery } from '@/components/OrderDeliveryForm'
import type { Locations } from '@/components/LocationFields'
import OrderPaymentForm from '@/components/OrderPaymentForm'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { formatMoney } from '@/lib/format'
import type { OrderSummary } from '@/lib/orders'
import { confirmAction } from '@/lib/confirm'

type Payment = {
  id: number
  amount_pesewas: number // negative = a refund
  via: string
  reference: string | null
  note: string | null
  by: string
  at: string
}

type Stamp = string | null

type Props = {
  order: OrderSummary & {
    customer_id: number
    customer_phone: string | null
    customer_location: string | null
    customer_country: string | null
    customer_region: string | null
    customer_place: string | null
    live: { id: number; title: string } | null
    recorded_by: string
    note: string | null
    profit_pesewas: number | null // null = may not see costs
    delivery: Delivery
    timeline: {
      paid: Stamp
      packed: Stamp
      delivered: Stamp
      cancelled: Stamp
      returned: Stamp
    }
    payments: Payment[]
  }
  locations: Locations
  ways_to_pay: { value: string; label: string; reference?: boolean }[]
  payment_names: Record<string, string> // every method, hidden ones too
  // What this person may do to this order right now (OrdersController#show).
  can: {
    change: boolean
    edit: boolean
    remove_items: boolean
    fulfil: boolean
    refund: boolean
    cancel: boolean
  }
}

// Props from OrdersController#show
export default function OrderShow({ order, locations, ways_to_pay, payment_names, can }: Props) {
  // Which of the small forms is open. Only ever one at a time.
  const [open, setOpen] = useState<'delivery' | 'refund' | 'return' | null>(null)
  const [restock, setRestock] = useState<'yes' | 'no' | ''>('')

  const { status, balance_pesewas: balance, paid_pesewas: paid, delivery, timeline } = order
  const gone = status === 'cancelled' || status === 'returned'
  const owes = balance > 0 // the buyer owes her
  const toGiveBack = balance < 0 ? -balance : 0 // she owes the buyer
  const wayLabel = (via: string) => payment_names[via] ?? via

  // The return form: how many of each line are coming back. Starts at
  // everything they still have, since a full return is the usual case.
  const returnable = order.items.filter((item) => item.quantity - item.returned > 0)
  const [coming, setComing] = useState<Record<number, string>>({})
  const back = (item: OrderSummary['items'][number]) => {
    const typed = coming[item.id]
    return typed === undefined ? item.quantity - item.returned : Number.parseInt(typed, 10) || 0
  }
  const backCount = returnable.reduce((sum, item) => sum + back(item), 0)

  // -> Orders::StagesController#update
  function move(to: 'packed' | 'delivered' | 'back') {
    router.patch(`/admin/orders/${order.id}/stage`, { to }, { preserveScroll: true })
  }

  async function cancel() {
    const money = paid > 0 ? ` You will still need to give back the ${formatMoney(paid)} they paid.` : ''
    if (!(await confirmAction(`Cancel ${order.customer}'s order? Everything on it goes back into stock.${money}`, { confirm: 'Cancel the order', dismiss: 'Keep the order', danger: true }))) return
    router.patch(`/admin/orders/${order.id}/cancel`) // -> OrdersController#cancel
  }

  async function remove(item: OrderSummary['items'][number]) {
    if (!(await confirmAction(`Remove ${item.name}? It goes back into stock.`, { confirm: 'Remove', danger: true }))) return
    router.delete(`/admin/orders/${order.id}/items/${item.id}`, {
      preserveScroll: true,
    })
  }

  function recordReturn() {
    // -> Orders::ReturnsController#create
    router.post(
      `/admin/orders/${order.id}/return`,
      { restock: restock === 'yes', items: Object.fromEntries(returnable.map((item) => [item.id, back(item)])) },
      { onSuccess: () => setOpen(null) },
    )
  }

  // The one sentence that says where this order stands.
  const headline =
    status === 'cancelled'
      ? `Cancelled ${timeline.cancelled ?? ''}`
      : status === 'returned'
        ? `Returned ${timeline.returned ?? ''}`
        : status === 'claimed'
          ? paid > 0
            ? `${formatMoney(balance)} still to pay`
            : `Waiting for ${formatMoney(balance)}`
          : status === 'paid'
            ? 'Paid in full. Ready to pack.'
            : status === 'packed'
              ? owes
                ? `Packed. Collect ${formatMoney(balance)} on delivery.`
                : 'Packed and paid. Ready to go out.'
              : owes
                ? `Delivered. ${formatMoney(balance)} still owed.`
                : 'Delivered and paid. All done.'

  return (
    <AppLayout>
      <Head title={`Order for ${order.customer}`} />

      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Orders
      </Link>

      <div className="mt-2">
        <PageHeader
          title={order.customer}
          description={`Order ${order.id}. Claimed ${order.at}. Recorded by ${order.recorded_by}.`}
          actions={
            can.edit && (
              <ButtonLink href={`/admin/orders/${order.id}/edit`} variant="secondary">
                <Pencil className="size-5" aria-hidden="true" />
                Edit
              </ButtonLink>
            )
          }
        />
        {order.note && <p className="mt-3 max-w-3xl border-l-2 border-taupe-300 pl-3 whitespace-pre-line text-taupe-800">{order.note}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <OrderStatusBadge status={status} />
        {order.channel && <p className="text-taupe-800">Came from {order.channel}</p>}
        {order.live && (
          <Link href={`/admin/live/${order.live.id}`} className="text-wine-800 underline decoration-taupe-400 underline-offset-4">
            {order.live.title}
          </Link>
        )}
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone.replace(/[^\d+]/g, '')}`}
            className="flex items-center gap-1.5 font-medium text-wine-800 underline decoration-taupe-400 underline-offset-4"
          >
            <Phone className="size-4" aria-hidden="true" />
            {order.customer_phone}
          </a>
        )}
      </div>

      {/* Phone order: where it stands, what's on it, money, delivery.
          On wide screens the first and last sit together in a side column.

          The trick: the side column is a real box only from `xl` up. Below
          that it is `display: contents`, which makes the box vanish from the
          layout so its two children become grid items themselves and can be
          placed with `order-*` around the main column. */}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <div className="contents xl:col-start-3 xl:row-start-1 xl:block xl:space-y-6">
          {/* ---------- Where it stands, and the next step ---------- */}
          <section className="order-1 rounded-lg border border-wine-200 bg-wine-50 p-5">
            <h2 className="font-display text-2xl font-semibold text-wine-800">{headline}</h2>

            {!gone && (
              <div className="mt-5">
                <Steps
                  steps={[
                    { label: 'Claimed', done: true },
                    {
                      label: 'Paid',
                      done: !owes && paid > 0,
                      note: timeline.paid,
                    },
                    {
                      label: 'Packed',
                      done: status === 'packed' || status === 'delivered',
                      note: timeline.packed,
                    },
                    {
                      label: 'Delivered',
                      done: status === 'delivered',
                      note: timeline.delivered,
                    },
                  ]}
                />
              </div>
            )}

            {can.fulfil && !gone && (
              <div className="mt-5 flex flex-col gap-3">
                {status === 'claimed' && (
                  <>
                    <p className="text-taupe-800">Record the payment below when it arrives.</p>
                    <Button type="button" variant="secondary" block onClick={() => move('packed')}>
                      Pack it now, they pay on delivery
                    </Button>
                  </>
                )}
                {status === 'paid' && (
                  <>
                    <Button type="button" block onClick={() => move('packed')}>
                      Mark as packed
                    </Button>
                    <Button type="button" variant="secondary" block onClick={() => move('delivered')}>
                      Already handed over
                    </Button>
                  </>
                )}
                {status === 'packed' && (
                  <>
                    <Button type="button" block onClick={() => move('delivered')}>
                      Mark as delivered
                    </Button>
                    <Button type="button" variant="secondary" block onClick={() => move('back')}>
                      Undo: not packed yet
                    </Button>
                  </>
                )}
                {status === 'delivered' && (
                  <Button type="button" variant="secondary" block onClick={() => move('back')}>
                    Undo: not delivered yet
                  </Button>
                )}
              </div>
            )}

            {gone && toGiveBack > 0 && (
              <p className="mt-3 text-taupe-800">
                They paid {formatMoney(paid)}. Record the refund under Payments once you have sent it back.
              </p>
            )}

            {/* ---------- Undoing the sale ---------- */}
            {(can.cancel || (can.refund && status === 'delivered')) && (
              <div className="mt-5 border-t border-wine-200 pt-4">
                {can.cancel && (
                  <Button type="button" variant="danger" block onClick={cancel}>
                    Cancel order
                  </Button>
                )}
                {can.refund && status === 'delivered' && open !== 'return' && (
                  <Button type="button" variant="danger" block onClick={() => setOpen('return')}>
                    They sent it back
                  </Button>
                )}
                {open === 'return' && (
                  <div className="space-y-4">
                    <fieldset>
                      <legend className="text-sm font-medium text-taupe-800">What came back?</legend>
                      <ul className="mt-1.5 divide-y divide-taupe-200 rounded-lg border border-taupe-300 bg-white">
                        {returnable.map((item) => (
                          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                            <span className="min-w-0 flex-1 basis-32">{item.name}</span>
                            <QuantityStepper
                              label={`${item.name} returned`}
                              value={String(back(item) || '')}
                              max={item.quantity - item.returned}
                              onChange={(value) => setComing({ ...coming, [item.id]: value === '' ? '0' : value })}
                            />
                          </li>
                        ))}
                      </ul>
                    </fieldset>
                    <ChoiceCards
                      legend="What condition are the items in?"
                      name="restock"
                      choices={[
                        {
                          value: 'yes',
                          label: 'Fine to sell again',
                          description: 'Put them back in stock',
                        },
                        {
                          value: 'no',
                          label: 'Not fit to sell',
                          description: 'Leave stock as it is',
                        },
                      ]}
                      value={restock}
                      onChange={setRestock}
                    />
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" variant="danger" disabled={restock === '' || backCount === 0} onClick={recordReturn}>
                        Record the return
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setOpen(null)}>
                        Not now
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ---------- Delivery ---------- */}
          <Panel
            title="Delivery"
            className="order-3"
            action={
              can.change &&
              open !== 'delivery' &&
              delivery.method && (
                <button
                  type="button"
                  onClick={() => setOpen('delivery')}
                  className="min-h-11 px-2 font-medium text-wine-800 underline underline-offset-4"
                >
                  Change
                </button>
              )
            }
          >
            {open === 'delivery' ? (
              <OrderDeliveryForm
                orderId={order.id}
                delivery={delivery}
                locations={locations}
                known={{ country: order.customer_country, region: order.customer_region, place: order.customer_place, address: order.customer_location }}
                onDone={() => setOpen(null)}
              />
            ) : delivery.method === null ? (
              <div className="space-y-3">
                <p className="text-taupe-700">Not decided yet.</p>
                {can.change && (
                  <Button type="button" variant="secondary" onClick={() => setOpen('delivery')}>
                    Add delivery details
                  </Button>
                )}
              </div>
            ) : delivery.method === 'pickup' ? (
              <p>They will collect it.</p>
            ) : (
              <div className="space-y-1">
                <p>Being sent to them{delivery.place ? ` in ${delivery.place}, ${delivery.region ?? delivery.country}` : ''}, {delivery.fee_pesewas > 0 ? `${formatMoney(delivery.fee_pesewas)} delivery` : 'free delivery'}.</p>
                {/* whitespace-pre-line keeps the line breaks she typed. */}
                {delivery.address ? (
                  <p className="whitespace-pre-line text-taupe-800">{delivery.address}</p>
                ) : (
                  <p className="text-taupe-700">No address yet.</p>
                )}
              </div>
            )}
          </Panel>
        </div>

        <div className="order-2 space-y-6 xl:col-span-2 xl:col-start-1 xl:row-start-1">
          {/* ---------- What's on it ---------- */}
          <Panel title={order.units === 1 ? '1 item' : `${order.units} items`}>
            {order.items.length === 0 ? (
              <p className="text-taupe-700">Everything was removed from this order.</p>
            ) : (
              <ul className="-mx-5 -mt-5 divide-y divide-taupe-200">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      {item.quantity > 1 && <span className="font-semibold tabular-nums">{item.quantity} × </span>}
                      {item.name}
                      {item.returned > 0 && (
                        <span className="block text-sm text-taupe-600">
                          {item.returned === item.quantity ? 'Returned' : `${item.returned} returned`}
                        </span>
                      )}
                    </span>
                    <span className="font-medium tabular-nums">{formatMoney(item.total_pesewas)}</span>
                    {can.remove_items && (
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        aria-label={`Remove ${item.name}`}
                        className="flex size-10 items-center justify-center rounded-md text-taupe-600 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
                      >
                        <X className="size-5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-4 space-y-1.5 border-t border-taupe-200 pt-4 tabular-nums">
              {delivery.fee_pesewas > 0 && (
                <>
                  <div className="flex items-baseline justify-between text-taupe-800">
                    <dt>Items</dt>
                    <dd>{formatMoney(order.total_pesewas)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between text-taupe-800">
                    <dt>Delivery</dt>
                    <dd>{formatMoney(delivery.fee_pesewas)}</dd>
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between">
                <dt className="font-medium">Total</dt>
                <dd className="text-2xl font-semibold text-wine-800">{formatMoney(order.total_pesewas + delivery.fee_pesewas)}</dd>
              </div>
              {paid > 0 && (
                <div className="flex items-baseline justify-between text-taupe-800">
                  <dt>Paid</dt>
                  <dd>{formatMoney(paid)}</dd>
                </div>
              )}
              {owes && paid > 0 && (
                <div className="flex items-baseline justify-between font-medium">
                  <dt>Still to pay</dt>
                  <dd>{formatMoney(balance)}</dd>
                </div>
              )}
              {toGiveBack > 0 && (
                <div className="flex items-baseline justify-between font-medium text-red-800">
                  <dt>To give back</dt>
                  <dd>{formatMoney(toGiveBack)}</dd>
                </div>
              )}
              {order.profit_pesewas !== null && !gone && (
                <div className="flex items-baseline justify-between text-taupe-700">
                  <dt>Your profit on it</dt>
                  <dd>{formatMoney(order.profit_pesewas)}</dd>
                </div>
              )}
            </dl>
          </Panel>

          {/* ---------- Money ---------- */}
          <Panel title="Payments">
            {order.payments.length === 0 ? (
              <p className="text-taupe-700">Nothing has been paid yet.</p>
            ) : (
              <ul className="-mx-5 -mt-5 divide-y divide-taupe-200">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex items-baseline gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {payment.amount_pesewas < 0 ? 'Refund' : 'Payment'}, {wayLabel(payment.via).toLowerCase()}
                      </span>
                      <span className="block text-sm text-taupe-600">
                        {payment.at}, by {payment.by}
                        {payment.reference && `. ID ${payment.reference}`}
                        {payment.note && `. ${payment.note}`}
                      </span>
                    </span>
                    <span className={`font-semibold tabular-nums ${payment.amount_pesewas < 0 ? 'text-red-800' : ''}`}>
                      {payment.amount_pesewas < 0 ? '− ' : ''}
                      {formatMoney(Math.abs(payment.amount_pesewas))}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Money in: whenever something is owed. `key` rebuilds the form
                when the balance changes, so its amount starts at what is
                owed NOW, not what was owed when the page first opened. */}
            {can.fulfil && owes && (
              <div className="mt-4 border-t border-taupe-200 pt-4">
                <OrderPaymentForm key={`pay-${balance}`} orderId={order.id} kind="payment" suggestedPesewas={balance} ways={ways_to_pay} />
              </div>
            )}

            {/* Money out: open by itself when a refund is due, otherwise
                behind a quiet button. */}
            {can.refund && paid > 0 && (
              <div className="mt-4 border-t border-taupe-200 pt-4">
                {toGiveBack > 0 || open === 'refund' ? (
                  <OrderPaymentForm
                    key={`refund-${paid}-${balance}`}
                    orderId={order.id}
                    kind="refund"
                    suggestedPesewas={toGiveBack}
                    ways={ways_to_pay}
                    onCancel={toGiveBack > 0 ? undefined : () => setOpen(null)}
                  />
                ) : (
                  <Button type="button" variant="secondary" onClick={() => setOpen('refund')}>
                    Give money back
                  </Button>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AppLayout>
  )
}
