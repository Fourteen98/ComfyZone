import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import Button from '@/components/ui/Button'
import DeliveryFields from '@/components/DeliveryFields'
import type { DeliveryChoice } from '@/components/DeliveryFields'
import LocationFields from '@/components/LocationFields'
import type { Locations, Where } from '@/components/LocationFields'

export type Delivery = {
  method: 'pickup' | 'delivery' | null // null = not decided yet
  fee: string // as typed, e.g. "25"
  fee_pesewas: number
  address: string | null
  region: string | null // where it is going
  place: string | null
}

type Props = {
  orderId: number
  delivery: Delivery
  locations: Locations
  /** Where this customer usually is, to start the form with. */
  known: { region: string | null; place: string | null; address: string | null }
  onDone: () => void
}

// Changing delivery on an order that already exists. The questions
// themselves live in DeliveryFields and LocationFields, shared with the
// record-a-sale screen.
export default function OrderDeliveryForm({ orderId, delivery, locations, known, onDone }: Props) {
  const form = useForm<DeliveryChoice & Where>({
    delivery_method: delivery.method ?? '',
    region: delivery.region ?? known.region ?? '',
    place: delivery.place ?? known.place ?? '',
    fee: delivery.fee_pesewas > 0 ? delivery.fee : '',
    address: delivery.address ?? known.address ?? '',
  })
  // Rails names the errors after the Order's attributes.
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ delivery: data }))
    // -> Orders::DeliveriesController#update
    form.patch(`/orders/${orderId}/delivery`, { preserveScroll: true, onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DeliveryFields
        value={form.data}
        onChange={(value) => {
          form.setData({ ...form.data, ...value })
          form.clearErrors()
        }}
        errors={errors}
        where={
          <LocationFields
            name="delivery_where"
            value={form.data}
            locations={locations}
            // Landing on a known place fills in its usual fee.
            onChange={(where, place) =>
              form.setData({ ...form.data, ...where, fee: place && place.fee_pesewas > 0 ? place.fee : form.data.fee })
            }
          />
        }
      />

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
