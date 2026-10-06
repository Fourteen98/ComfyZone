import { useForm } from '@inertiajs/react'
import { Bike, Store } from 'lucide-react'
import type { FormEvent } from 'react'
import Button from '@/components/ui/Button'
import ChoiceCards from '@/components/ui/ChoiceCards'
import MoneyField from '@/components/ui/MoneyField'
import TextAreaField from '@/components/ui/TextAreaField'

export type Delivery = {
  method: 'pickup' | 'delivery' | null // null = not decided yet
  fee: string // as typed, e.g. "25"
  fee_pesewas: number
  address: string | null
}

type Props = {
  orderId: number
  delivery: Delivery
  /** Where this customer usually is, to start the address box with. */
  knownLocation: string | null
  onDone: () => void
}

export default function OrderDeliveryForm({ orderId, delivery, knownLocation, onDone }: Props) {
  const form = useForm({
    delivery_method: (delivery.method ?? '') as 'pickup' | 'delivery' | '',
    fee: delivery.fee_pesewas > 0 ? delivery.fee : '',
    address: delivery.address ?? knownLocation ?? '',
  })
  // Rails names the errors after the Order's attributes.
  const errors = form.errors as Record<string, string[] | undefined>
  const sending = form.data.delivery_method === 'delivery'

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ delivery: data }))
    // -> Orders::DeliveriesController#update
    form.patch(`/orders/${orderId}/delivery`, { preserveScroll: true, onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ChoiceCards
        legend="How will they get it?"
        name="delivery_method"
        choices={[
          { value: 'pickup', label: 'They collect it', icon: Store },
          { value: 'delivery', label: 'It is sent to them', icon: Bike },
        ]}
        value={form.data.delivery_method}
        onChange={(delivery_method) => {
          form.setData('delivery_method', delivery_method)
          form.clearErrors()
        }}
        error={errors.delivery_method}
      />

      {sending && (
        <>
          <MoneyField
            id="delivery_fee"
            label="What they pay for delivery"
            hint="Added to what they owe. Leave empty if delivery is free."
            value={form.data.fee}
            onChange={(e) => {
              form.setData('fee', e.target.value)
              form.clearErrors()
            }}
            error={errors.delivery_fee}
          />
          <TextAreaField
            id="delivery_address"
            label="Where to"
            rows={3}
            placeholder="Area, landmark, and a number the rider can call"
            value={form.data.address}
            onChange={(e) => form.setData('address', e.target.value)}
            error={errors.delivery_address}
          />
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={form.processing || form.data.delivery_method === ''}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Not now
        </Button>
      </div>
    </form>
  )
}
