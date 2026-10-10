import { router, usePage } from '@inertiajs/react'
import { MapPin } from 'lucide-react'
import { useRef, useState } from 'react'
import Alert from '@/components/ui/Alert'
import { formatPhone } from '@/lib/phone'
import BuyerPicker from '@/components/BuyerPicker'
import { bulkNudge, bulkOn, unitPrice } from '@/lib/bulk'
import type { Buyer, BuyerChoice } from '@/components/BuyerPicker'
import Button from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import ProductPicker from '@/components/ProductPicker'
import type { SellableProduct, SellableVariant } from '@/components/ProductPicker'
import DeliveryFields, { noDelivery } from '@/components/DeliveryFields'
import type { DeliveryChoice } from '@/components/DeliveryFields'
import LocationFields, { findPlace, nowhere, said } from '@/components/LocationFields'
import type { Locations, Where } from '@/components/LocationFields'
import QuantityStepper from '@/components/ui/QuantityStepper'
import { formatMoney, toPesewas } from '@/lib/format'
import type { SalesChannel } from '@/lib/orders'

export type { SellableProduct, SellableVariant }
export type { Buyer }

type Props = {
  products: SellableProduct[]
  buyers: Buyer[]
  /** The running live this claim belongs to. Leave out for a sale outside a live. */
  liveId?: number
  /** The platform the live is on ("TikTok"), for the wording of the buyer box. */
  liveChannel?: string | null
  /** Outside a live: the places a sale can come from, for her to pick one. */
  channels?: SalesChannel[]
  /** Outside a live: Ghana's regions and the places known in each. */
  locations?: Locations
}

// The "who wants what" screen. It has two ways of asking WHO:
//
//   During a live      one box for a username, built for one thumb and
//                      speed. The sale's channel is the live's.
//   Recording a sale   pick where it came from (WhatsApp, a walk-in...),
//                      then search her customers or add a new one by name,
//                      phone or username. See BuyerPicker.
//
// Then, both ways: tap a product, then the size and colour, and tap Claim.
//
// Stock shown here was correct when the page loaded. Rails checks it again
// at the moment of the claim, and refuses if something has just sold out.
export default function SaleCapture({ products, buyers, liveId, liveChannel, channels = [], locations }: Props) {
  const errors = usePage().props.errors as Record<string, string[] | undefined>
  const [waitHint, setWaitHint] = useState<string | null>(null)
  const buyerInput = useRef<HTMLInputElement>(null)
  const inLive = liveId !== undefined

  // During a live: the typed username.
  const [buyer, setBuyer] = useState('')
  // Recording a sale: the channel, and who BuyerPicker says is chosen.
  const [channelId, setChannelId] = useState('')
  const [choice, setChoice] = useState<{ buyer: BuyerChoice; label: string } | null>(null)
  const [sales, setSales] = useState(0) // counts sales made, to reset BuyerPicker
  const [delivery, setDelivery] = useState<DeliveryChoice>(noDelivery)
  // Where the buyer is: country, region, place. Starts at "Ghana, not known".
  const home = locations?.home ?? ''
  const [where, setWhere] = useState<Where>(nowhere(home))
  const [basket, setBasket] = useState<Record<number, number>>({}) // variant id -> quantity
  const [sending, setSending] = useState(false)

  // Look up any variant (and its product) by id.
  const variants = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.id, { variant, product }] as const)))

  const lines = Object.entries(basket)
    .map(([id, quantity]) => ({ ...variants.get(Number(id))!, quantity }))
    .filter((line) => line.variant && line.quantity > 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)

  // Is the buyer marked as a bulk buyer? On a live: the username typed. Recording
  // a sale: the customer picked.
  const chosenId = choice && 'id' in choice.buyer ? choice.buyer.id : null
  const buyerRecord = inLive
    ? buyers.find((b) => b.handle === buyer.trim().replace(/^@/, '').toLowerCase())
    : buyers.find((b) => b.id === chosenId)
  const bulkBuyer = !!buyerRecord?.bulk_buyer

  // Bulk prices: count each PRODUCT in this sale (any size or colour). A
  // bulk buyer gets it whatever the count. On a live the server also counts
  // what they claimed earlier in the live, so the final price may be lower still.
  const pieces = new Map<number, number>()
  lines.forEach((line) => pieces.set(line.product.id, (pieces.get(line.product.id) ?? 0) + line.quantity))
  const priced = lines.map((line) => {
    const on = bulkOn(line.product.bulk, pieces.get(line.product.id) ?? 0, bulkBuyer)
    return { ...line, bulk: on, unit: unitPrice(line.variant.price_pesewas, line.product.bulk, on) }
  })
  const total = priced.reduce((sum, line) => sum + line.quantity * line.unit, 0)

  const setQuantity = (variant: SellableVariant, quantity: number) =>
    setBasket({ ...basket, [variant.id]: Math.max(0, Math.min(quantity, variant.stock)) })
  const addOne = (variant: SellableVariant) => setQuantity(variant, (basket[variant.id] ?? 0) + 1)

  // ----- the buyer box -----
  const typed = buyer.trim().replace(/^@/, '').toLowerCase()
  const known = buyers.find((b) => b.handle === typed)

  // ----- during a live: where the buyer is -----
  // `liveWhere` is only what SHE has entered for this claim (null = she
  // hasn't touched it). What is shown falls back to where a known buyer
  // already is. Only a location she actually entered is sent, so a claim
  // never rewrites where a known customer lives by accident.
  const [liveWhere, setLiveWhere] = useState<Where | null>(null)
  const [whereOpen, setWhereOpen] = useState(false)
  const knownWhere: Where | null =
    known?.country || known?.region ? { country: known.country ?? home, region: known.region ?? '', place: known.place ?? '' } : null
  const shownWhere = liveWhere ?? knownWhere ?? nowhere(home)
  const whereSummary = [shownWhere.place, shownWhere.region, shownWhere.country !== home ? shownWhere.country : '']
    .filter(Boolean)
    .join(', ')
  const suggestions =
    typed && !known ? buyers.filter((b) => b.handle?.includes(typed) || b.name?.toLowerCase().includes(typed)).slice(0, 5) : []

  // For the total on screen only. Rails works out the real fee on save.
  const deliveryFee = !inLive && delivery.delivery_method === 'delivery' ? toPesewas(delivery.fee) : 0
  const channel = channels.find((c) => String(c.id) === channelId)
  const who = inLive ? (typed ? `@${typed}` : '') : (choice?.label ?? '')

  // A sold-out size tapped: put this buyer on its waiting list, so she can
  // tell them when it's back (WaitingListController#create).
  function waitlist(variant: SellableVariant, product: SellableProduct) {
    const who = inLive
      ? typed
        ? { buyer: { handle: typed, name: '', phone: '' } }
        : null
      : choice
        ? 'id' in choice.buyer
          ? { customer_id: choice.buyer.id }
          : { buyer: choice.buyer }
        : null
    if (!who) {
      setWaitHint(`Say who is asking first, then tap ${product.name}, ${variant.name} again to add them to the waiting list.`)
      return
    }
    setWaitHint(null)
    router.post(
      '/admin/waiting',
      { variant_id: variant.id, source: inLive ? 'live' : 'sale', ...who },
      { preserveScroll: true, preserveState: true },
    )
  }

  function claim() {
    setSending(true)
    router.post(
      '/admin/orders', // -> OrdersController#create
      {
        order: {
          // A live sends the typed username; a recorded sale sends an object.
          buyer: inLive ? buyer : choice?.buyer,
          live_session_id: liveId,
          sales_channel_id: inLive ? undefined : channelId || undefined,
          // Pick-up or delivery, if she chose. During a live it is sorted out afterwards.
          delivery: inLive || delivery.delivery_method === '' ? undefined : delivery,
          // Where the buyer is. Saved on the customer, delivered or not.
          location: !locations
            ? undefined
            : inLive
              ? liveWhere && said(locations, liveWhere)
                ? liveWhere
                : undefined
              : said(locations, where)
                ? where
                : undefined,
          items: lines.map((line) => ({ variant_id: line.variant.id, quantity: line.quantity })),
        },
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          // Ready for the next buyer straight away. The channel is kept:
          // several WhatsApp orders are often entered one after another.
          setBasket({})
          setBuyer('')
          setChoice(null)
          setDelivery(noDelivery)
          setWhere(nowhere(home))
          setLiveWhere(null)
          setWhereOpen(false)
          setSales(sales + 1)
          buyerInput.current?.focus()
        },
        onFinish: () => setSending(false),
      },
    )
  }

  const ready = who !== '' && units > 0 && !sending
  const claimLabel = sending ? 'Saving…' : who ? `${inLive ? 'Claim' : 'Record sale'} for ${who}` : inLive ? 'Claim' : 'Record sale'

  return (
    // pb leaves room for the claim bar that floats above the phone's bottom bar.
    // One grid, two arrangements.
    //   Phone:   buyer, then this claim (once something is picked), then products.
    //   Desktop: buyer and products down the left; this claim pinned on the right.
    // The elements are written in phone order; the lg: classes move the
    // claim panel into the second column without changing the HTML.
    <div className="grid items-start gap-x-6 gap-y-5 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
      {/* ---------- 1. Who ---------- */}
      <section className="space-y-4 lg:col-start-1">
        {waitHint && <Alert tone="error">{waitHint}</Alert>}
        {(errors.items || errors.customer || errors.base) && (
          <Alert tone="error">{(errors.items ?? errors.customer ?? errors.base)![0]}</Alert>
        )}
        {inLive ? (
          <div>
            <label htmlFor="buyer" className="block text-sm font-medium text-taupe-800">
              Who is claiming?
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg text-taupe-600">@</span>
              <input
                ref={buyerInput}
                id="buyer"
                // Stop phones "correcting" or capitalising a username.
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder={liveChannel ? `their ${liveChannel} name` : 'their username'}
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                className="block min-h-14 w-full rounded-md border-taupe-300 bg-white pr-3.5 pl-9 text-lg placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
              />
            </div>
            {known ? (
              <p className="mt-1.5 text-sm text-emerald-800">
                {known.name ? `${known.name}, bought` : 'Bought'} from you before{known.phone ? `. ${formatPhone(known.phone)}` : ''}.
              </p>
            ) : (
              typed &&
              suggestions.length === 0 && <p className="mt-1.5 text-sm text-taupe-700">New buyer. They will be saved with this claim.</p>
            )}
            {suggestions.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onClick={() => setBuyer(suggestion.handle ?? '')}
                      disabled={!suggestion.handle}
                      className="min-h-10 rounded-full border border-taupe-300 bg-white px-3.5 text-sm hover:border-wine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
                    >
                      <span className="font-medium">@{suggestion.handle}</span>
                      {suggestion.name && <span className="text-taupe-700"> {suggestion.name}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Where they are. Folded away so a claim stays one box and one
                tap; opened when she wants to note it. Pick-up or delivery is
                chosen later, on the order. */}
            {locations && typed && (
              <div className="mt-3">
                {whereOpen ? (
                  <div className="rounded-lg border border-taupe-200 bg-white p-4">
                    <LocationFields name="live_where" value={shownWhere} locations={locations} onChange={setLiveWhere} />
                    <button
                      type="button"
                      onClick={() => setWhereOpen(false)}
                      className="mt-3 min-h-11 font-medium text-wine-800 underline underline-offset-4"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWhereOpen(true)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-md border border-dashed border-taupe-300 px-3 text-left text-taupe-800 hover:border-wine-700"
                  >
                    <MapPin className="size-5 shrink-0 text-wine-800" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{whereSummary || 'Add where they are'}</span>
                    <span className="text-sm font-medium text-wine-800">{whereSummary ? 'Change' : 'Add'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {channels.length > 0 && (
              <ChoicePills
                legend="Where did this sale come from?"
                name="sales_channel"
                choices={channels.map((c) => ({ value: String(c.id), label: c.name }))}
                value={channelId}
                onChange={setChannelId}
              />
            )}
            {/* A new key throws the old picker away and builds an empty one. */}
            <BuyerPicker
              key={sales}
              buyers={buyers}
              usernameFirst={channel?.kind === 'social'}
              onChange={(buyer, label, known) => {
                setChoice(buyer ? { buyer, label } : null)
                // A customer we know: start from where they were last
                // time, with that place's usual delivery fee.
                if (known) {
                  const there = { country: known.country ?? home, region: known.region ?? '', place: known.place ?? '' }
                  const place = locations && findPlace(locations, there)
                  setWhere(there)
                  setDelivery({ ...delivery, fee: place && place.fee_pesewas > 0 ? place.fee : '', address: known.location ?? '' })
                }
              }}
            />
            {locations && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-taupe-800">Where are they? (optional)</legend>
                <LocationFields
                  value={where}
                  locations={locations}
                  onChange={(next, place) => {
                    setWhere(next)
                    // Landing on a known place fills in its usual fee.
                    if (place && place.fee_pesewas > 0) setDelivery({ ...delivery, fee: place.fee })
                  }}
                />
              </fieldset>
            )}
            <DeliveryFields value={delivery} onChange={setDelivery} errors={errors} />
          </>
        )}
      </section>

      {/* ---------- 3. The claim ----------
          Desktop: a panel on the right that stays in view.
          Phone: the lines sit here, between the buyer and the products
          (hidden until something is picked), and the total with the Claim
          button floats just above the bottom bar (see the end of this file). */}
      <aside className={`lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${lines.length === 0 ? 'hidden lg:block' : ''}`}>
        <div className="rounded-lg border border-taupe-200 bg-white">
          <h2 className="border-b border-taupe-200 px-5 py-3.5 font-display text-2xl font-semibold text-wine-800">
            {inLive ? 'This claim' : 'This sale'}
          </h2>
          {lines.length === 0 ? (
            <p className="px-5 py-5 text-taupe-700">Nothing picked yet. Tap a product to add it.</p>
          ) : (
            <ul className="divide-y divide-taupe-200">
              {priced.map((line) => {
                const nudge = bulkNudge(line.product.bulk, pieces.get(line.product.id) ?? 0, bulkBuyer)
                return (
                  <li key={line.variant.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{line.product.name}</p>
                      <p className="text-sm text-taupe-700 tabular-nums">
                        {line.variant.option_values.length > 0 && `${line.variant.name}, `}
                        {line.unit < line.variant.price_pesewas ? (
                          <>
                            <span className="line-through">{formatMoney(line.variant.price_pesewas)}</span>{' '}
                            <span className="font-medium text-emerald-800">{formatMoney(line.unit)} bulk</span>
                          </>
                        ) : (
                          formatMoney(line.variant.price_pesewas)
                        )}
                      </p>
                      {nudge && <p className="text-sm text-emerald-800">{nudge}</p>}
                    </div>
                    <QuantityStepper
                      label={`${line.product.name} ${line.variant.name}`}
                      value={String(line.quantity)}
                      max={line.variant.stock}
                      onChange={(value) => setQuantity(line.variant, Number.parseInt(value, 10) || 0)}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <div className="hidden border-t border-taupe-200 p-5 lg:block">
            <p className="flex items-baseline justify-between tabular-nums">
              <span className="text-taupe-700">{units === 1 ? '1 item' : `${units} items`}</span>
              <span className="text-2xl font-semibold text-wine-800">{formatMoney(total + deliveryFee)}</span>
            </p>
            {deliveryFee > 0 && <p className="text-right text-sm text-taupe-700">includes {formatMoney(deliveryFee)} delivery</p>}
            <Button type="button" block className="mt-4" disabled={!ready} onClick={claim}>
              {claimLabel}
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- 2. What ---------- */}
      <section className="lg:col-start-1">
        {/* key: a fresh picker (empty search, nothing open) after each sale. */}
        <ProductPicker
          key={sales}
          label={inLive ? 'What are they claiming?' : 'What are they buying?'}
          products={products}
          basket={basket}
          onAdd={addOne}
          onWaitlist={waitlist}
        />
      </section>

      {/* The floating claim bar, phones only. bottom-14 sits it on top of the
          app's bottom navigation; env(safe-area-inset-bottom) clears the
          home indicator on iPhones. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-taupe-200 bg-white px-4 py-2.5 shadow-[0_-4px_16px_rgb(42_31_29/0.12)] lg:hidden">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 tabular-nums">
            <span className="block text-sm text-taupe-700">{units === 1 ? '1 item' : `${units} items`}</span>
            <span className="block text-xl leading-tight font-semibold text-wine-800">{formatMoney(total + deliveryFee)}</span>
          </p>
          <Button type="button" disabled={!ready} onClick={claim} className="max-w-[60%] truncate">
            {claimLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
