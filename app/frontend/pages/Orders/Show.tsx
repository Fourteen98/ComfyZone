import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, Clock, MessageCircle, Pencil, X } from 'lucide-react'
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
import PhoneLinks from '@/components/PhoneLinks'
import SwapForm from '@/components/SwapForm'
import type { SwapLine } from '@/components/SwapForm'
import type { SellableProduct } from '@/components/ProductPicker'
import ReliabilityBadge from '@/components/ReliabilityBadge'
import type { Reliability } from '@/components/ReliabilityBadge'

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
    whatsapp: { chat_id: number; hold_until: string | null; payment_claimed: string | null } | null
    // The pay-by deadline while it runs (ClaimHold); null = none or stopped.
    hold: { until: string; overdue: boolean; whatsapp: boolean } | null
    can_hold: boolean // unpaid with no deadline: one can be started
    cancel_reason: string | null // "unpaid" = released because they never paid
    remind_url: string | null // WhatsApp from her phone, message ready
    reliability: Reliability
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
  /** For "swap a size". null when no swap is possible or allowed. */
  swap: { lines: SwapLine[]; products: SellableProduct[] } | null
  // What this person may do to this order right now (OrdersController#show).
  can: {
    change: boolean
    edit: boolean
    remove_items: boolean
    fulfil: boolean
    refund: boolean
    swap: boolean
    cancel: boolean
  }
}

// Props from OrdersController#show
export default function OrderShow({ order, locations, ways_to_pay, payment_names, swap, can }: Props) {
  // Which of the small forms is open. Only ever one at a time.
  const [open, setOpen] = useState<'delivery' | 'refund' | 'return' | 'swap' | null>(null)
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
    if (
      !(await confirmAction(`Cancel ${order.customer}'s order? Everything on it goes back into stock.${money}`, {
        confirm: 'Cancel the order',
        dismiss: 'Keep the order',
        danger: true,
      }))
    )
      return
    router.patch(`/admin/orders/${order.id}/cancel`) // -> OrdersController#cancel
  }

  // The pay-by deadline: more time, or none. -> Orders::HoldsController
  const giveTime = (hours: number) => router.patch(`/admin/orders/${order.id}/hold`, { hours }, { preserveScroll: true })
  const noDeadline = () => router.delete(`/admin/orders/${order.id}/hold`, { preserveScroll: true })

  // They never paid: cancel it, and their record shows it (Customer reliability).
  async function release() {
    const sure = await confirmAction(
      `Release ${order.customer}'s order? They never paid. Everything on it goes back on sale, and their record will show an unpaid order.`,
      { confirm: 'Release it', dismiss: 'Keep it', danger: true },
    )
    if (sure) router.patch(`/admin/orders/${order.id}/cancel`, { reason: 'unpaid' }) // -> OrdersController#cancel
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
        {order.reliability && (
          <p className="mt-2">
            <ReliabilityBadge reliability={order.reliability} long />
          </p>
        )}
        {/* The pay-by deadline (live claims and recorded sales; WhatsApp has its own note below). */}
        {order.hold && !order.hold.whatsapp && (
          <div
            className={`mt-3 max-w-3xl rounded-lg border px-4 py-3 ${
              order.hold.overdue ? 'border-red-300 bg-red-50 text-red-950' : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                {order.hold.overdue ? (
                  <>
                    <strong>Time is up.</strong> It goes back on sale within a minute.
                  </>
                ) : (
                  <>
                    <strong>Pay by {order.hold.until}</strong>, or everything on it goes back on sale.
                  </>
                )}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {order.remind_url && (
                <a
                  href={order.remind_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-wine-800 px-3 text-sm font-medium text-taupe-50 hover:bg-wine-700"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Remind on WhatsApp
                </a>
              )}
              <Button type="button" variant="secondary" onClick={() => giveTime(24)}>
                One more day
              </Button>
              <Button type="button" variant="secondary" onClick={noDeadline}>
                No deadline
              </Button>
            </div>
          </div>
        )}
        {order.can_hold && (
          <p className="mt-3 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 text-sm text-taupe-700">
            Not paid, and no deadline: it keeps its items until you decide.
            <button type="button" onClick={() => giveTime(24)} className="min-h-10 font-medium text-wine-800 hover:underline">
              Give them 24 hours
            </button>
          </p>
        )}
        {status === 'cancelled' && order.cancel_reason === 'unpaid' && (
          <p className="mt-3 max-w-3xl text-taupe-800">Released because it was never paid.</p>
        )}
        {order.note && <p className="mt-3 max-w-3xl border-l-2 border-taupe-300 pl-3 whitespace-pre-line text-taupe-800">{order.note}</p>}
        {/* Reserved on WhatsApp: check the payment they say they made, or see the clock. */}
        {order.whatsapp && (order.whatsapp.payment_claimed || order.whatsapp.hold_until) && (
          <p
            className={`mt-3 max-w-3xl rounded-lg px-4 py-3 ${
              order.whatsapp.payment_claimed ? 'border border-amber-300 bg-amber-50 text-amber-950' : 'bg-taupe-100 text-taupe-800'
            }`}
          >
            {order.whatsapp.payment_claimed ? (
              <>
                <strong>They say they paid on WhatsApp</strong> (ref: {order.whatsapp.payment_claimed}). Check your MoMo, then record the
                payment below.
              </>
            ) : (
              <>Reserved on WhatsApp: released at {order.whatsapp.hold_until} if not paid.</>
            )}{' '}
            <Link href={`/admin/whatsapp/${order.whatsapp.chat_id}`} className="font-medium underline underline-offset-4">
              Open the chat
            </Link>
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <OrderStatusBadge status={status} />
        {order.channel && <p className="text-taupe-800">Came from {order.channel}</p>}
        {order.live && (
          <Link href={`/admin/live/${order.live.id}`} className="text-wine-800 underline decoration-taupe-400 underline-offset-4">
            {order.live.title}
          </Link>
        )}
        {order.customer_phone && <PhoneLinks phone={order.customer_phone} />}
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
            {(can.cancel || (can.refund && status === 'delivered') || (can.swap && swap)) && (
              <div className="mt-5 space-y-2 border-t border-wine-200 pt-4">
                {/* A size that didn't fit: some of a line comes back, another goes out. */}
                {can.swap && swap && swap.lines.length > 0 && open !== 'swap' && open !== 'return' && (
                  <Button type="button" variant="secondary" block onClick={() => setOpen('swap')}>
                    Swap or refund an item
                  </Button>
                )}
                {open === 'swap' && swap && (
                  <SwapForm
                    orderId={order.id}
                    customerId={order.customer_id}
                    customerName={order.customer}
                    paidPesewas={paid}
                    deliveryFeePesewas={delivery.fee_pesewas}
                    waysToPay={ways_to_pay}
                    delivered={status === 'delivered'}
                    lines={swap.lines}
                    products={swap.products}
                    onClose={() => setOpen(null)}
                  />
                )}
                {/* Never paid: release it, and it counts against them. */}
                {can.cancel && status === 'claimed' && paid === 0 && (
                  <Button type="button" variant="danger" block onClick={release}>
                    They didn't pay: release it
                  </Button>
                )}
                {can.cancel && (
                  <Button type="button" variant="danger" block onClick={cancel}>
                    Cancel order
                  </Button>
                )}
                {can.refund && status === 'delivered' && open !== 'return' && open !== 'swap' && (
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
                known={{
                  country: order.customer_country,
                  region: order.customer_region,
                  place: order.customer_place,
                  address: order.customer_location,
                }}
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
                <p>
                  Being sent to them{delivery.place ? ` in ${delivery.place}, ${delivery.region ?? delivery.country}` : ''},{' '}
                  {delivery.fee_pesewas > 0 ? `${formatMoney(delivery.fee_pesewas)} delivery` : 'free delivery'}.
                </p>
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
                      {item.bulk && <span className="block text-sm text-emerald-800">Bulk price</span>}
                      {item.agreed && (
                        <span className="block text-sm text-wine-800">
                          Agreed price{item.normal_price_pesewas ? `, normally ${formatMoney(item.normal_price_pesewas)} each` : ''}
                        </span>
                      )}
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
