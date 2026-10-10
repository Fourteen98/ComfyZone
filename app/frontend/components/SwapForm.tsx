import { router } from '@inertiajs/react'
import { Hourglass, Repeat, Wallet } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import ChoiceCards from '@/components/ui/ChoiceCards'
import ChoicePills from '@/components/ui/ChoicePills'
import MoneyField from '@/components/ui/MoneyField'
import TextField from '@/components/ui/TextField'
import { Swatch } from '@/components/ui/Chip'
import QuantityStepper from '@/components/ui/QuantityStepper'
import SelectField from '@/components/ui/SelectField'
import VariantFinder from '@/components/VariantFinder'
import type { SellableProduct, SellableVariant } from '@/components/ProductPicker'
import { formatMoney, toMoneyInput, toPesewas } from '@/lib/format'

export type SwapLine = { id: number; variant_id: number; product_id: number; name: string; kept: number; unit_price_pesewas: number }

type Props = {
  orderId: number
  customerId: number
  customerName: string
  delivered: boolean
  /** What they have paid so far: a refund can't be more. */
  paidPesewas: number
  /** The delivery fee, refunded too if nothing is left on the order. */
  deliveryFeePesewas: number
  waysToPay: { value: string; label: string; reference?: boolean }[]
  lines: SwapLine[]
  products: SellableProduct[]
  onClose: () => void
}

// "It didn't fit": swap some of one line for another size (or another
// piece). -> Orders::SwapsController#create, which calls Order#swap!.
//
// The other sizes of the same product are offered first as buttons, since
// that is nearly always the swap. Anything else can be searched for.
export default function SwapForm({
  orderId,
  customerId,
  customerName,
  delivered,
  paidPesewas,
  deliveryFeePesewas,
  waysToPay,
  lines,
  products,
  onClose,
}: Props) {
  const [lineId, setLineId] = useState(lines.length === 1 ? String(lines[0].id) : '')
  const [quantity, setQuantity] = useState('1')
  const [to, setTo] = useState<{ product: SellableProduct; variant: SellableVariant } | null>(null)
  const [restock, setRestock] = useState(true)
  const [samePrice, setSamePrice] = useState(true)
  const [sendAgain, setSendAgain] = useState(true)
  const [busy, setBusy] = useState(false)
  // What they want instead: another size/colour/piece, or their money.
  const [outcome, setOutcome] = useState<'swap' | 'refund' | ''>('')
  // A sold-out size/colour she tapped: what they really wanted.
  const [wanted, setWanted] = useState<SellableVariant | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [via, setVia] = useState('')
  const [reference, setReference] = useState('')

  const line = lines.find((entry) => String(entry.id) === lineId)
  const product = line ? products.find((entry) => entry.id === line.product_id) : undefined
  const others = product ? product.variants.filter((variant) => variant.id !== line?.variant_id) : []
  const count = Math.min(Number.parseInt(quantity, 10) || 0, line?.kept ?? 0)
  const differentPiece = to !== null && line !== undefined && to.product.id !== line.product_id
  const priceDiffers = to !== null && line !== undefined && to.variant.price_pesewas !== line.unit_price_pesewas

  // What the money will do, said before saving.
  const newPrice = to && line ? (samePrice ? line.unit_price_pesewas : to.variant.price_pesewas) : 0
  const difference = line ? (newPrice - line.unit_price_pesewas) * count : 0

  // Everything still on the order is coming back: the delivery fee goes back too.
  const keptOnOrder = lines.reduce((sum, entry) => sum + entry.kept, 0)
  const everything = line !== undefined && count >= keptOnOrder
  const suggestedRefund = Math.min(paidPesewas, (line ? line.unit_price_pesewas * count : 0) + (everything ? deliveryFeePesewas : 0))

  function chooseOutcome(next: 'swap' | 'refund') {
    setOutcome(next)
    if (next === 'refund') setRefundAmount(toMoneyInput(suggestedRefund))
  }

  function takeBack() {
    if (!line || count === 0) return
    setBusy(true)
    router.post(
      `/admin/orders/${orderId}/take_back`,
      { item_id: line.id, quantity: count, restock, refund: toPesewas(refundAmount) > 0, amount: refundAmount, via, reference },
      { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: onClose },
    )
  }

  // They wanted something sold out: put them on its waiting list, so she
  // can tell them when it is back (WaitingListController#create).
  function waitlist(variant: SellableVariant) {
    router.post(
      '/admin/waiting',
      { variant_id: variant.id, customer_id: customerId, source: 'sale' },
      { preserveScroll: true, preserveState: true },
    )
    setWanted(null)
  }

  function save() {
    if (!line || !to || count === 0) return
    setBusy(true)
    router.post(
      `/admin/orders/${orderId}/swap`,
      { item_id: line.id, variant_id: to.variant.id, quantity: count, restock, same_price: samePrice, send_again: delivered && sendAgain },
      { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: onClose },
    )
  }

  const pick = (variant: SellableVariant, from: SellableProduct) => {
    setTo({ product: from, variant })
    // A different piece is charged at its own price by default; a size swap keeps the price.
    setSamePrice(from.id === line?.product_id)
  }

  return (
    <div className="space-y-4">
      {lines.length > 1 && (
        <SelectField
          id="swap_line"
          label="Which one is coming back?"
          placeholder="Choose the item"
          options={lines.map((entry) => ({ value: entry.id, label: entry.name }))}
          value={lineId}
          onChange={(e) => {
            setLineId(e.target.value)
            setTo(null)
            setQuantity('1')
          }}
        />
      )}

      {line && (
        <>
          {line.kept > 1 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-taupe-800">How many?</span>
              <QuantityStepper
                label={`${line.name} to swap`}
                value={quantity}
                max={line.kept}
                onChange={(value) => setQuantity(value || '1')}
              />
            </div>
          )}

          <ChoiceCards
            legend="What do they want instead?"
            name="swap_outcome"
            choices={[
              { value: 'swap', label: 'Something else', description: 'Another size, colour or piece', icon: Repeat },
              {
                value: 'refund',
                label: 'Their money back',
                description: "What they want isn't in stock, or they changed their mind",
                icon: Wallet,
              },
            ]}
            value={outcome}
            onChange={chooseOutcome}
          />

          {outcome === 'refund' && (
            <div className="space-y-4 rounded-lg border border-taupe-200 bg-white p-4">
              <MoneyField
                id="refund_amount"
                label="Refund"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                hint={
                  everything
                    ? `Everything they paid, ${formatMoney(paidPesewas)}, delivery included: nothing is left on the order.`
                    : `What ${count} cost them. Leave empty to refund later. They have paid ${formatMoney(paidPesewas)}.`
                }
              />
              {toPesewas(refundAmount) > 0 && (
                <>
                  <ChoicePills legend="How are you paying it back?" name="refund_via" choices={waysToPay} value={via} onChange={setVia} />
                  <TextField
                    id="refund_reference"
                    label="Reference (optional)"
                    maxLength={60}
                    placeholder="MoMo transaction ID"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </>
              )}
            </div>
          )}

          {outcome === 'swap' && (
            <fieldset>
              <legend className="text-sm font-medium text-taupe-800">Swap for</legend>
              {others.length > 0 && product && (
                <ul className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {others.map((variant) => {
                    const chosen = to?.variant.id === variant.id
                    const enough = variant.stock >= Math.max(count, 1)
                    return (
                      <li key={variant.id}>
                        <button
                          type="button"
                          // Not enough of it: tapping says so and offers the waiting list.
                          onClick={() => (enough ? pick(variant, product) : setWanted(variant))}
                          aria-pressed={chosen}
                          className={`flex min-h-14 w-full flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left ${
                            chosen
                              ? 'border-wine-800 bg-wine-50 ring-1 ring-wine-800'
                              : enough
                                ? 'border-taupe-300 bg-white hover:border-wine-700'
                                : 'border-dashed border-taupe-300 bg-taupe-50 text-taupe-600'
                          }`}
                        >
                          <span className="flex flex-wrap items-center gap-x-1.5 font-medium">
                            {variant.option_values.map((value) => (
                              <span key={value.name} className="inline-flex items-center gap-1">
                                {value.swatch && <Swatch colour={value.swatch} />}
                                {value.label}
                              </span>
                            ))}
                          </span>
                          <span className="text-sm text-taupe-700 tabular-nums">
                            {variant.stock > 0 ? `${variant.stock} left` : 'Sold out'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {wanted && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  <p>
                    <strong>{wanted.name}</strong> is sold out. Put {customerName} on the waiting list for it? Then swap for something else
                    for now, or give their money back.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" className="min-h-10! px-3!" onClick={() => waitlist(wanted)}>
                      <Hourglass className="size-4" aria-hidden="true" />
                      Add to waiting list
                    </Button>
                    <Button type="button" variant="secondary" className="min-h-10! px-3!" onClick={() => chooseOutcome('refund')}>
                      Give their money back
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <VariantFinder
                  id="swap_find"
                  label={others.length ? 'Or something else' : 'Find what they want instead'}
                  products={products}
                  onPick={(from, variant) => pick(variant as SellableVariant, from as SellableProduct)}
                />
              </div>
              {to && (
                <p className="mt-2 text-sm text-taupe-800">
                  Swapping {count} × {line.name} for <strong>{to.variant.name}</strong>
                  {differentPiece ? ` (${to.product.name})` : ''}.
                </p>
              )}
            </fieldset>
          )}

          {outcome === 'swap' && to && priceDiffers && (
            <Checkbox
              label="Keep the price they paid"
              description={`The new one sells at ${formatMoney(to.variant.price_pesewas)}. Untick to charge (or refund) the difference.`}
              checked={samePrice}
              onChange={(e) => setSamePrice(e.target.checked)}
            />
          )}
          <Checkbox
            label="The one coming back can be sold again"
            description="Puts it back in stock. Untick if it is damaged."
            checked={restock}
            onChange={(e) => setRestock(e.target.checked)}
          />
          {outcome === 'swap' && delivered && (
            <Checkbox
              label="Send the new one out"
              description='Moves the order back to "To deliver".'
              checked={sendAgain}
              onChange={(e) => setSendAgain(e.target.checked)}
            />
          )}

          {outcome === 'swap' && to && difference !== 0 && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${difference > 0 ? 'bg-amber-50 text-amber-950' : 'bg-emerald-50 text-emerald-900'}`}
            >
              {difference > 0 ? `They will owe ${formatMoney(difference)} more.` : `You will owe them ${formatMoney(-difference)} back.`}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        {outcome === 'refund' ? (
          <Button type="button" disabled={!line || count === 0 || busy || (toPesewas(refundAmount) > 0 && via === '')} onClick={takeBack}>
            {busy
              ? 'Saving…'
              : toPesewas(refundAmount) > 0
                ? `Take it back and refund ${formatMoney(toPesewas(refundAmount))}`
                : 'Take it back'}
          </Button>
        ) : (
          <Button type="button" disabled={outcome !== 'swap' || !line || !to || count === 0 || busy} onClick={save}>
            {busy ? 'Swapping…' : 'Record the swap'}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  )
}
