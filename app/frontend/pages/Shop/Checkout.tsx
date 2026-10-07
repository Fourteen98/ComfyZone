import { Head, useForm } from '@inertiajs/react'
import { Bike, Store } from 'lucide-react'
import type { FormEvent } from 'react'
import ShopLayout from '@/layouts/ShopLayout'
import Button from '@/components/ui/Button'
import ChoiceCards from '@/components/ui/ChoiceCards'
import TextAreaField from '@/components/ui/TextAreaField'
import TextField from '@/components/ui/TextField'
import LocationFields, { findPlace, nowhere } from '@/components/LocationFields'
import type { Locations } from '@/components/LocationFields'
import BagLine from '@/components/shop/BagLine'
import type { BagLineData } from '@/components/shop/BagLine'
import { formatMoney } from '@/lib/format'

type Props = {
  cart: { lines: BagLineData[]; total_pesewas: number }
  locations: Locations
  pay_online: boolean
}

// Props from Shop::CheckoutController#show
export default function ShopCheckout({ cart, locations }: Props) {
  const form = useForm({
    name: '',
    phone: '',
    delivery_method: '' as 'pickup' | 'delivery' | '',
    where: nowhere(locations.home),
    address: '',
    note: '',
  })
  const errors = form.errors as Record<string, string[] | undefined>
  const sending = form.data.delivery_method === 'delivery'

  // If they are somewhere she has set a usual delivery fee for, show it now
  // rather than surprise them later. Rails works out the real figure.
  const place = sending ? findPlace(locations, form.data.where) : undefined
  const fee = place && place.fee_pesewas > 0 ? place.fee_pesewas : null

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ checkout: data }))
    form.post('/checkout') // -> Shop::CheckoutController#create
  }

  return (
    <ShopLayout>
      <Head title="Checkout" />
      <h1 className="mt-8 font-display text-4xl font-semibold text-wine-800 sm:text-5xl">Checkout</h1>

      <form onSubmit={submit} className="mt-6 space-y-10">
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-wine-800">1. About you</h2>
          <TextField
            id="name"
            label="Your name"
            required
            maxLength={60}
            autoComplete="name"
            value={form.data.name}
            onChange={(e) => form.setData('name', e.target.value)}
            error={errors.name}
          />
          <TextField
            id="phone"
            label="Phone number"
            type="tel"
            required
            maxLength={25}
            autoComplete="tel"
            placeholder="e.g. 024 123 4567"
            value={form.data.phone}
            onChange={(e) => form.setData('phone', e.target.value)}
            error={errors.phone ?? errors.customer}
          />
          <p className="-mt-2 text-sm text-taupe-700">We will call or WhatsApp this number about your order.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-wine-800">2. Getting it to you</h2>
          <ChoiceCards
            legend="How would you like it?"
            name="delivery_method"
            choices={[
              { value: 'pickup', label: 'I will collect it', description: 'We will tell you where and when', icon: Store },
              { value: 'delivery', label: 'Send it to me', description: 'By rider or courier', icon: Bike },
            ]}
            value={form.data.delivery_method}
            onChange={(delivery_method) => {
              form.setData('delivery_method', delivery_method)
              form.clearErrors('delivery_method')
            }}
            error={errors.delivery_method}
          />

          {sending && (
            <>
              <LocationFields
                shopper
                value={form.data.where}
                locations={locations}
                onChange={(where) => {
                  form.setData('where', where)
                  form.clearErrors('region' as never)
                }}
                errors={{ region: errors.region }}
              />
              <TextAreaField
                id="address"
                label="Address or landmark"
                rows={2}
                required
                maxLength={300}
                placeholder="Street, house, a landmark the rider will know"
                value={form.data.address}
                onChange={(e) => form.setData('address', e.target.value)}
                error={errors.address}
              />
              <p className="rounded-xl bg-taupe-100 p-4 text-sm text-taupe-800">
                {fee !== null
                  ? `Delivery to ${place?.name} is usually ${formatMoney(fee)}. It is added to your total below.`
                  : 'We will confirm the delivery cost with you by phone before sending.'}
              </p>
            </>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-wine-800">3. Paying</h2>
          <p className="rounded-xl border border-taupe-200 bg-white p-4 text-taupe-800">
            Nothing to pay now. Once you place the order we will contact you to confirm it, and you pay by Mobile Money or cash{' '}
            {sending ? 'on delivery' : 'when you collect'}.
          </p>
          <TextAreaField
            id="note"
            label="Anything we should know? (optional)"
            rows={2}
            maxLength={300}
            value={form.data.note}
            onChange={(e) => form.setData('note', e.target.value)}
            error={errors.note}
          />
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-wine-800">Your order</h2>
          <ul className="mt-4 space-y-4">
            {cart.lines.map((line) => (
              <li key={line.variant_id}>
                <BagLine line={line}>
                  <p className="mt-1 text-sm text-taupe-700">Quantity {line.quantity}</p>
                </BagLine>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-2 border-t border-taupe-200 pt-4 tabular-nums">
            <div className="flex justify-between">
              <dt className="text-taupe-800">Items</dt>
              <dd>{formatMoney(cart.total_pesewas)}</dd>
            </div>
            {sending && (
              <div className="flex justify-between">
                <dt className="text-taupe-800">Delivery</dt>
                <dd>{fee !== null ? formatMoney(fee) : 'To be confirmed'}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-2">
              <dt className="font-medium">Total{sending && fee === null ? ', before delivery' : ''}</dt>
              <dd className="text-3xl font-semibold text-wine-800">{formatMoney(cart.total_pesewas + (fee ?? 0))}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <Button type="submit" block disabled={form.processing}>
              {form.processing ? 'Placing your order…' : 'Place order'}
            </Button>
            <p className="mt-3 text-center text-sm text-taupe-700">Your pieces are held for you as soon as you place the order.</p>
          </div>
        </section>
      </form>
    </ShopLayout>
  )
}
