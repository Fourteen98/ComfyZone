import { router, usePage } from '@inertiajs/react'
import { ChevronDown, Search, Shirt } from 'lucide-react'
import { useRef, useState } from 'react'
import Alert from '@/components/ui/Alert'
import BuyerPicker from '@/components/BuyerPicker'
import type { Buyer, BuyerChoice } from '@/components/BuyerPicker'
import Button from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import { Swatch } from '@/components/ui/Chip'
import QuantityStepper from '@/components/ui/QuantityStepper'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney } from '@/lib/format'
import type { SalesChannel } from '@/lib/orders'

export type SellableVariant = {
  id: number
  name: string
  option_values: (OptionValue & { name: string })[]
  stock: number
  price_pesewas: number
}
export type SellableProduct = { id: number; name: string; thumb_url: string | null; variants: SellableVariant[] }
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
export default function SaleCapture({ products, buyers, liveId, liveChannel, channels = [] }: Props) {
  const errors = usePage().props.errors as Record<string, string[] | undefined>
  const buyerInput = useRef<HTMLInputElement>(null)
  const inLive = liveId !== undefined

  // During a live: the typed username.
  const [buyer, setBuyer] = useState('')
  // Recording a sale: the channel, and who BuyerPicker says is chosen.
  const [channelId, setChannelId] = useState('')
  const [choice, setChoice] = useState<{ buyer: BuyerChoice; label: string } | null>(null)
  const [sales, setSales] = useState(0) // counts sales made, to reset BuyerPicker
  const [basket, setBasket] = useState<Record<number, number>>({}) // variant id -> quantity
  const [search, setSearch] = useState('')
  const [openProduct, setOpenProduct] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  // Look up any variant (and its product) by id.
  const variants = new Map(
    products.flatMap((product) => product.variants.map((variant) => [variant.id, { variant, product }] as const)),
  )

  const lines = Object.entries(basket)
    .map(([id, quantity]) => ({ ...variants.get(Number(id))!, quantity }))
    .filter((line) => line.variant && line.quantity > 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.quantity * line.variant.price_pesewas, 0)

  const left = (variant: SellableVariant) => variant.stock - (basket[variant.id] ?? 0)
  const setQuantity = (variant: SellableVariant, quantity: number) =>
    setBasket({ ...basket, [variant.id]: Math.max(0, Math.min(quantity, variant.stock)) })
  const addOne = (variant: SellableVariant) => setQuantity(variant, (basket[variant.id] ?? 0) + 1)

  // ----- the buyer box -----
  const typed = buyer.trim().replace(/^@/, '').toLowerCase()
  const known = buyers.find((b) => b.handle === typed)
  const suggestions =
    typed && !known
      ? buyers.filter((b) => b.handle?.includes(typed) || b.name?.toLowerCase().includes(typed)).slice(0, 5)
      : []

  // ----- the product list -----
  const term = search.trim().toLowerCase()
  const shown = products.filter((product) => product.name.toLowerCase().includes(term))

  function tapProduct(product: SellableProduct) {
    // A product with nothing to choose between is added in one tap.
    if (product.variants.length === 1 && product.variants[0].option_values.length === 0) {
      if (left(product.variants[0]) > 0) addOne(product.variants[0])
    } else {
      setOpenProduct(openProduct === product.id ? null : product.id)
    }
  }

  const channel = channels.find((c) => String(c.id) === channelId)
  const who = inLive ? (typed ? `@${typed}` : '') : (choice?.label ?? '')

  function claim() {
    setSending(true)
    router.post(
      '/orders', // -> OrdersController#create
      {
        order: {
          // A live sends the typed username; a recorded sale sends an object.
          buyer: inLive ? buyer : choice?.buyer,
          live_session_id: liveId,
          sales_channel_id: inLive ? undefined : channelId || undefined,
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
          setSales(sales + 1)
          setSearch('')
          setOpenProduct(null)
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
        {(errors.items || errors.customer || errors.base) && (
          <Alert tone="error">{(errors.items ?? errors.customer ?? errors.base)![0]}</Alert>
        )}
        {inLive ? (
          <div>
            <label htmlFor="buyer" className="block text-sm font-medium text-taupe-800">
              Who is claiming?
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg text-taupe-600">
                @
              </span>
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
                {known.name ? `${known.name}, bought` : 'Bought'} from you before{known.phone ? `. ${known.phone}` : ''}.
              </p>
            ) : (
              typed &&
              suggestions.length === 0 && (
                <p className="mt-1.5 text-sm text-taupe-700">New buyer. They will be saved with this claim.</p>
              )
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
              onChange={(buyer, label) => setChoice(buyer ? { buyer, label } : null)}
            />
          </>
        )}
      </section>

      {/* ---------- 3. The claim ----------
          Desktop: a panel on the right that stays in view.
          Phone: the lines sit here, between the buyer and the products
          (hidden until something is picked), and the total with the Claim
          button floats just above the bottom bar (see the end of this file). */}
      <aside
        className={`lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${lines.length === 0 ? 'hidden lg:block' : ''}`}
      >
        <div className="rounded-lg border border-taupe-200 bg-white">
          <h2 className="border-b border-taupe-200 px-5 py-3.5 font-display text-2xl font-semibold text-wine-800">
            {inLive ? 'This claim' : 'This sale'}
          </h2>
          {lines.length === 0 ? (
            <p className="px-5 py-5 text-taupe-700">Nothing picked yet. Tap a product to add it.</p>
          ) : (
            <ul className="divide-y divide-taupe-200">
              {lines.map((line) => (
                <li key={line.variant.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{line.product.name}</p>
                    <p className="text-sm text-taupe-700 tabular-nums">
                      {line.variant.option_values.length > 0 && `${line.variant.name}, `}
                      {formatMoney(line.variant.price_pesewas)}
                    </p>
                  </div>
                  <QuantityStepper
                    label={`${line.product.name} ${line.variant.name}`}
                    value={String(line.quantity)}
                    max={line.variant.stock}
                    onChange={(value) => setQuantity(line.variant, Number.parseInt(value, 10) || 0)}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="hidden border-t border-taupe-200 p-5 lg:block">
            <p className="flex items-baseline justify-between tabular-nums">
              <span className="text-taupe-700">{units === 1 ? '1 item' : `${units} items`}</span>
              <span className="text-2xl font-semibold text-wine-800">{formatMoney(total)}</span>
            </p>
            <Button type="button" block className="mt-4" disabled={!ready} onClick={claim}>
              {claimLabel}
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- 2. What ---------- */}
      <section className="lg:col-start-1">
        <label htmlFor="sale-search" className="block text-sm font-medium text-taupe-800">
          {inLive ? 'What are they claiming?' : 'What are they buying?'}
        </label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-taupe-500" aria-hidden="true" />
          <input
            id="sale-search"
            type="search"
            placeholder="Search products"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block min-h-12 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
          />
        </div>

        {shown.length === 0 ? (
          <p className="mt-4 text-center text-taupe-700">
            {term ? `No product matches "${search.trim()}".` : 'You have no products to sell yet.'}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-taupe-200 overflow-hidden rounded-lg border border-taupe-200 bg-white">
            {shown.map((product) => {
              const stock = product.variants.reduce((sum, variant) => sum + Math.max(left(variant), 0), 0)
              const simple = product.variants.length === 1 && product.variants[0].option_values.length === 0
              const open = openProduct === product.id
              const inBasket = product.variants.reduce((sum, variant) => sum + (basket[variant.id] ?? 0), 0)
              const prices = product.variants.map((variant) => variant.price_pesewas)
              const from = Math.min(...prices)

              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => tapProduct(product)}
                    disabled={stock === 0 && inBasket === 0}
                    aria-expanded={simple ? undefined : open}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700 disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span className="flex aspect-[4/5] w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-taupe-200 text-taupe-500">
                      {product.thumb_url ? (
                        <img src={product.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <Shirt className="size-5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block text-sm text-taupe-700 tabular-nums">
                        {Math.max(...prices) === from ? formatMoney(from) : `from ${formatMoney(from)}`}
                        {stock === 0 ? ', none left' : `, ${stock} left`}
                      </span>
                    </span>
                    {inBasket > 0 && (
                      <span className="flex size-7 items-center justify-center rounded-full bg-wine-800 text-sm font-semibold text-taupe-50 tabular-nums">
                        {inBasket}
                      </span>
                    )}
                    {!simple && (
                      <ChevronDown
                        className={`size-5 shrink-0 text-taupe-500 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {/* The sizes and colours, shown when the product is tapped. */}
                  {open && !simple && (
                    <ul className="grid grid-cols-2 gap-2 bg-taupe-50 px-3 py-3 sm:grid-cols-3">
                      {product.variants.map((variant) => {
                        const remaining = left(variant)
                        const chosen = basket[variant.id] ?? 0
                        return (
                          <li key={variant.id}>
                            <button
                              type="button"
                              onClick={() => addOne(variant)}
                              disabled={remaining <= 0}
                              className={`flex min-h-14 w-full flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 disabled:opacity-45 ${
                                chosen > 0
                                  ? 'border-wine-800 bg-wine-50'
                                  : 'border-taupe-300 bg-white hover:border-wine-700'
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
                                {remaining <= 0
                                  ? variant.stock === 0
                                    ? 'Sold out'
                                    : 'All in this claim'
                                  : `${remaining} left`}
                                {chosen > 0 && <span className="font-semibold text-wine-800">, {chosen} picked</span>}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* The floating claim bar, phones only. bottom-14 sits it on top of the
          app's bottom navigation; env(safe-area-inset-bottom) clears the
          home indicator on iPhones. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-taupe-200 bg-white px-4 py-2.5 shadow-[0_-4px_16px_rgb(42_31_29/0.12)] lg:hidden">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 tabular-nums">
            <span className="block text-sm text-taupe-700">{units === 1 ? '1 item' : `${units} items`}</span>
            <span className="block text-xl leading-tight font-semibold text-wine-800">{formatMoney(total)}</span>
          </p>
          <Button type="button" disabled={!ready} onClick={claim} className="max-w-[60%] truncate">
            {claimLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
