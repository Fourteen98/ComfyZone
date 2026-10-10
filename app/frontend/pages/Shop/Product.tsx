import { Head, Link, router, useForm } from '@inertiajs/react'
import { ArrowLeft, Check, Shirt } from 'lucide-react'
import { useState } from 'react'
import ShopLayout from '@/layouts/ShopLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import { Swatch } from '@/components/ui/Chip'
import QuantityStepper from '@/components/ui/QuantityStepper'
import PhoneField from '@/components/ui/PhoneField'
import TextField from '@/components/ui/TextField'
import { formatMoney } from '@/lib/format'

type OptionValue = { label: string; swatch?: string | null }
type Variant = {
  id: number
  option_values: (OptionValue & { name: string })[] // name = which option: "Size"
  price_pesewas: number
  availability: 'in_stock' | 'sold_out'
  max: number
  few_left: number | null
}

type Props = {
  product: {
    id: number
    name: string
    description: string | null
    category: string | null
    photos: { id: number; large_url: string; thumb_url: string }[]
    options: { name: string; values: OptionValue[] }[]
    variants: Variant[]
  }
  in_cart: Record<string, number> // variant id -> how many are already in the bag
}

// Props from Shop::ProductsController#show
export default function ShopProduct({ product, in_cart }: Props) {
  const [photo, setPhoto] = useState(0)
  // What they have picked so far: { Size: "M", Colour: "Black" }.
  // A product with no options has exactly one variant, already "chosen".
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState('1')
  const [adding, setAdding] = useState(false)

  const matches = (variant: Variant, choice: Record<string, string>) =>
    variant.option_values.every((value) => choice[value.name] === undefined || choice[value.name] === value.label)

  const complete = product.options.every((option) => picked[option.name] !== undefined)
  const chosen = complete ? product.variants.find((variant) => matches(variant, picked)) : undefined

  // Could this value still lead to something in stock, given the OTHER
  // options already picked? If not it is shown struck through.
  const available = (option: string, label: string) =>
    product.variants.some((variant) => variant.availability === 'in_stock' && matches(variant, { ...picked, [option]: label }))

  const prices = product.variants.map((variant) => variant.price_pesewas)
  const lowest = Math.min(...prices)
  const varies = lowest !== Math.max(...prices)
  const everythingGone = product.variants.every((variant) => variant.availability === 'sold_out')
  const alreadyIn = chosen ? (in_cart[String(chosen.id)] ?? 0) : 0
  const room = chosen ? Math.max(chosen.max - alreadyIn, 0) : 0

  function add() {
    if (!chosen) return
    setAdding(true)
    // -> Shop::CartController#add. Rails redirects back here with the new
    // bag count in the header.
    router.post(
      '/cart/items',
      { variant_id: chosen.id, quantity: Number.parseInt(quantity, 10) || 1 },
      { preserveScroll: true, onFinish: () => setAdding(false), onSuccess: () => setQuantity('1') },
    )
  }

  const missing = product.options.filter((option) => picked[option.name] === undefined).map((option) => option.name.toLowerCase())

  return (
    <ShopLayout wide>
      <Head title={product.name} />

      <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All pieces
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2 md:gap-12">
        {/* ---------- Photos ---------- */}
        <div>
          <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-taupe-200">
            {product.photos.length > 0 ? (
              <img src={product.photos[photo].large_url} alt={product.name} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-taupe-400">
                <Shirt className="size-16" aria-hidden="true" />
              </span>
            )}
          </div>
          {product.photos.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto">
              {product.photos.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setPhoto(index)}
                    aria-label={`Photo ${index + 1} of ${product.photos.length}`}
                    aria-current={index === photo}
                    className={`block aspect-[4/5] w-16 overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-wine-700 ${
                      index === photo ? 'border-wine-800' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={item.thumb_url} alt="" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------- Details and choosing ---------- */}
        <div className="md:pt-4">
          {product.category && <p className="text-xs tracking-[0.25em] text-taupe-600 uppercase">{product.category}</p>}
          <h1 className="mt-2 font-display text-4xl leading-none font-semibold text-wine-800 sm:text-5xl">{product.name}</h1>
          <p className="mt-3 text-2xl tabular-nums">
            {chosen ? (
              formatMoney(chosen.price_pesewas)
            ) : (
              <>
                {varies && <span className="text-base text-taupe-600">From </span>}
                {formatMoney(lowest)}
              </>
            )}
          </p>

          {everythingGone && (
            <p className="mt-6 rounded-xl bg-taupe-100 p-5 text-taupe-800">
              This one has sold out for now.{product.options.length > 0 ? ' Choose your size and we will tell you when it is back.' : ''}
            </p>
          )}
          {
            <>
              <div className="mt-6 space-y-5">
                {product.options.map((option) => (
                  <fieldset key={option.name}>
                    <legend className="text-sm font-medium text-taupe-800">
                      {option.name}
                      {picked[option.name] && <span className="font-normal text-taupe-600">: {picked[option.name]}</span>}
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const on = picked[option.name] === value.label
                        const can = available(option.name, value.label)
                        return (
                          <label
                            key={value.label}
                            className={`flex min-h-12 min-w-12 cursor-pointer items-center justify-center gap-2 rounded-full border px-4 font-medium has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-wine-700 ${
                              on
                                ? 'border-wine-800 bg-wine-800 text-white'
                                : can
                                  ? 'border-taupe-300 bg-white hover:border-wine-700'
                                  : 'border-taupe-200 bg-taupe-100 text-taupe-500 line-through'
                            }`}
                          >
                            {/* A real radio underneath, so arrow keys and screen readers work. */}
                            <input
                              type="radio"
                              name={option.name}
                              className="sr-only"
                              checked={on}
                              onChange={() => {
                                setPicked({ ...picked, [option.name]: value.label })
                                setQuantity('1')
                              }}
                            />
                            {value.swatch && <Swatch colour={value.swatch} className="size-4" />}
                            {value.label}
                            {!can && <span className="sr-only"> (sold out)</span>}
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>

              {/* What happens next, said out loud for screen readers too. */}
              <div className="mt-6" aria-live="polite">
                {!chosen ? (
                  <Button type="button" block disabled>
                    Choose {missing.join(' and ')}
                  </Button>
                ) : chosen.availability === 'sold_out' ? (
                  <NotifyMe variantId={chosen.id} />
                ) : room === 0 ? (
                  <p className="rounded-xl bg-taupe-100 p-4 text-taupe-800">You have all we have of this one in your bag.</p>
                ) : (
                  <div className="space-y-3">
                    {chosen.few_left !== null && <p className="text-sm font-medium text-wine-800">Only {chosen.few_left} left.</p>}
                    <div className="flex items-stretch gap-3">
                      <QuantityStepper label={product.name} value={quantity} onChange={(value) => setQuantity(value || '1')} max={room} />
                      <Button type="button" className="flex-1" onClick={add} disabled={adding}>
                        {adding ? 'Adding…' : 'Add to bag'}
                      </Button>
                    </div>
                  </div>
                )}

                {alreadyIn > 0 && (
                  <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-taupe-800">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="size-4 text-emerald-700" aria-hidden="true" />
                      {alreadyIn} in your bag.
                    </span>
                    <ButtonLink href="/cart" variant="secondary" className="min-h-10! px-4!">
                      See your bag
                    </ButtonLink>
                  </p>
                )}
              </div>
            </>
          }

          {product.description && (
            <div className="mt-8 border-t border-taupe-200 pt-6">
              <h2 className="text-sm font-medium text-taupe-800">About this piece</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-taupe-800">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </ShopLayout>
  )
}

// "Tell me when it's back" for a sold-out size: name and WhatsApp number,
// then she sees them on her waiting list (Shop::WaitingController).
function NotifyMe({ variantId }: { variantId: number }) {
  const form = useForm({ variant_id: variantId, name: '', phone: '' })
  const [sent, setSent] = useState(false)

  if (sent) {
    return <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900">Done. We will WhatsApp you as soon as it is back.</p>
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.post('/notify', { preserveScroll: true, onSuccess: () => setSent(true) })
      }}
      className="space-y-3 rounded-xl border border-taupe-200 bg-white p-4"
    >
      <p className="font-medium text-wine-800">That one has sold out. Want to know when it is back?</p>
      <TextField id="notify_name" label="Your name" maxLength={60} value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
      <PhoneField id="notify_phone" label="WhatsApp number" required value={form.data.phone} onChange={(phone) => form.setData('phone', phone)} />
      <Button type="submit" block disabled={form.processing || form.data.phone === ''}>
        Tell me when it is back
      </Button>
    </form>
  )
}
