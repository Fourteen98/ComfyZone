import { Head, Link, router, usePage } from '@inertiajs/react'
import { ArrowLeft, X } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import MoneyField from '@/components/ui/MoneyField'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import QuantityStepper from '@/components/ui/QuantityStepper'
import TextAreaField from '@/components/ui/TextAreaField'
import BuyerPicker from '@/components/BuyerPicker'
import type { Buyer, BuyerChoice } from '@/components/BuyerPicker'
import ProductPicker from '@/components/ProductPicker'
import type { SellableProduct, SellableVariant } from '@/components/ProductPicker'
import { formatMoney, toMoneyInput, toPesewas } from '@/lib/format'
import { statusLabels } from '@/lib/orders'
import type { OrderStatus, SalesChannel } from '@/lib/orders'

// One line of the order as it is being edited. Quantity and price are text,
// so a box can be empty while she is typing.
type Line = { variant_id: number; name: string; quantity: string; price: string }

// Props from OrdersController#edit
type Props = {
  order: {
    id: number
    status: OrderStatus
    customer: { id: number; label: string }
    sales_channel_id: string
    live: string | null // set = this order came from a live
    note: string
    lines_open: boolean // false once paid: items are then fixed
    items: { variant_id: number; name: string; quantity: number; price: string }[]
  }
  products: SellableProduct[] // stock already includes what this order holds
  buyers: Buyer[]
  channels: SalesChannel[]
}

export default function OrderEdit({ order, products, buyers, channels }: Props) {
  const errors = usePage().props.errors as Record<string, string[] | undefined>

  const [lines, setLines] = useState<Line[]>(order.items.map((item) => ({ ...item, quantity: String(item.quantity) })))
  const [channelId, setChannelId] = useState(order.sales_channel_id)
  const [note, setNote] = useState(order.note)
  const [changingBuyer, setChangingBuyer] = useState(false)
  const [newBuyer, setNewBuyer] = useState<{ buyer: BuyerChoice; label: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // How many of each variant could go on this order.
  const available = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.id, variant.stock] as const)))
  // The picker wants "variant id -> quantity", to show what is left.
  const basket = Object.fromEntries(lines.map((line) => [line.variant_id, Number.parseInt(line.quantity, 10) || 0]))

  const count = (line: Line) => Number.parseInt(line.quantity, 10) || 0
  const total = lines.reduce((sum, line) => sum + count(line) * toPesewas(line.price), 0)
  const units = lines.reduce((sum, line) => sum + count(line), 0)

  const change = (variantId: number, patch: Partial<Line>) =>
    setLines(lines.map((line) => (line.variant_id === variantId ? { ...line, ...patch } : line)))

  // Tapped in the product list: one more of it, or a new line at its usual price.
  function add(variant: SellableVariant) {
    const existing = lines.find((line) => line.variant_id === variant.id)
    if (existing) {
      change(variant.id, { quantity: String(count(existing) + 1) })
    } else {
      const product = products.find((p) => p.variants.some((v) => v.id === variant.id))!
      const name = variant.option_values.length > 0 ? `${product.name}, ${variant.name}` : product.name
      setLines([...lines, { variant_id: variant.id, name, quantity: '1', price: toMoneyInput(variant.price_pesewas) }])
    }
  }

  function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    router.patch(
      `/admin/orders/${order.id}`, // -> OrdersController#update
      {
        order: {
          // Left out unless she picked someone else, so Rails keeps the buyer.
          buyer: newBuyer?.buyer,
          sales_channel_id: channelId,
          note,
          // The whole order as it should now be. Rails works out what
          // changed and moves only the difference in stock.
          items: order.lines_open ? lines.map((line) => ({ variant_id: line.variant_id, quantity: count(line), price: line.price })) : undefined,
        },
      },
      { preserveScroll: true, onFinish: () => setSaving(false) },
    )
  }

  return (
    <AppLayout>
      <Head title={`Edit order for ${order.customer.label}`} />

      <Link href={`/admin/orders/${order.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the order
      </Link>
      <div className="mt-2">
        <PageHeader title="Edit order" description={`Order ${order.id}, ${statusLabels[order.status].toLowerCase()}.`} />
      </div>

      <form onSubmit={save} className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {(errors.items || errors.base || errors.customer) && <Alert tone="error">{(errors.items ?? errors.base ?? errors.customer)![0]}</Alert>}

          {/* ---------- What is on it ---------- */}
          <Panel title="Items">
            {!order.lines_open ? (
              <p className="text-taupe-700">
                The items can't be changed now, because the order is {statusLabels[order.status].toLowerCase()}. To change
                them, refund the payment first, or cancel the order and record it again.
              </p>
            ) : (
              <>
                {lines.length === 0 ? (
                  <p className="text-taupe-700">Nothing on the order. Add something below, or go back and cancel the order.</p>
                ) : (
                  <ul className="-mx-5 -mt-5 divide-y divide-taupe-200">
                    {lines.map((line) => (
                      <li key={line.variant_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                        {/* On a phone the name and the remove button share the
                            first row, with quantity and price underneath. From
                            `sm` up it is one row, and `order-last` sends the
                            button to the far end. */}
                        <p className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] font-medium sm:basis-40">{line.name}</p>
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((other) => other.variant_id !== line.variant_id))}
                          aria-label={`Remove ${line.name}`}
                          className="flex size-10 sm:order-last items-center justify-center rounded-md text-taupe-600 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
                        >
                          <X className="size-5" aria-hidden="true" />
                        </button>
                        <QuantityStepper
                          label={line.name}
                          value={line.quantity}
                          max={available.get(line.variant_id) ?? count(line)}
                          onChange={(quantity) => change(line.variant_id, { quantity })}
                        />
                        <div className="w-36">
                          <MoneyField
                            id={`price_${line.variant_id}`}
                            aria-label={`Price each for ${line.name}`}
                            value={line.price}
                            onChange={(e) => change(line.variant_id, { price: e.target.value })}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 flex items-baseline justify-between border-t border-taupe-200 pt-4 tabular-nums">
                  <span className="text-taupe-700">
                    {units === 1 ? '1 item' : `${units} items`}. The price is for one; change it if you charged something
                    different.
                  </span>
                  <span className="pl-4 text-2xl font-semibold whitespace-nowrap text-wine-800">{formatMoney(total)}</span>
                </p>
              </>
            )}
          </Panel>

          {order.lines_open && <ProductPicker label="Add something" products={products} basket={basket} onAdd={add} />}
        </div>

        {/* ---------- Who, where from, notes ---------- */}
        <div className="space-y-6">
          <Panel title="Buyer">
            {changingBuyer ? (
              <BuyerPicker
                buyers={buyers}
                usernameFirst={channels.find((c) => String(c.id) === channelId)?.kind === 'social'}
                onChange={(buyer, label) => setNewBuyer(buyer ? { buyer, label } : null)}
              />
            ) : (
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 truncate font-medium">{order.customer.label}</p>
                <Button type="button" variant="secondary" onClick={() => setChangingBuyer(true)}>
                  Change
                </Button>
              </div>
            )}
            {changingBuyer && (
              <p className="mt-3 text-sm text-taupe-700">
                {newBuyer ? `The order will move to ${newBuyer.label}.` : `Still ${order.customer.label} until you pick someone.`}
              </p>
            )}
          </Panel>

          <Panel title="Details">
            <div className="space-y-4">
              {order.live ? (
                <p className="text-taupe-800">Claimed on the live "{order.live}", so it came from wherever that live was.</p>
              ) : (
                <ChoicePills
                  legend="Where did this sale come from?"
                  name="sales_channel"
                  choices={channels.map((c) => ({ value: String(c.id), label: c.name }))}
                  value={channelId}
                  onChange={setChannelId}
                />
              )}
              <TextAreaField id="note" label="Note (optional)" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </Panel>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving || (order.lines_open && units === 0)}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <ButtonLink href={`/admin/orders/${order.id}`} variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
