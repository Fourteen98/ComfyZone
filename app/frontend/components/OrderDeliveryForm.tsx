import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import Button from '@/components/ui/Button'
import DeliveryFields from '@/components/DeliveryFields'
import type { DeliveryArea, DeliveryChoice } from '@/components/DeliveryFields'

export type Delivery = {
  method: 'pickup' | 'delivery' | null // null = not decided yet
  fee: string // as typed, e.g. "25"
  fee_pesewas: number
  address: string | null
  area_id: number | null
  area: string | null // its name
}

type Props = {
  orderId: number
  delivery: Delivery
  areas: DeliveryArea[]
  /** Where this customer usually is, to start the address box with. */
  knownLocation: string | null
  onDone: () => void
}

// Changing delivery on an order that already exists. The questions
// themselves live in DeliveryFields, shared with the record-a-sale screen.
export default function OrderDeliveryForm({ orderId, delivery, areas, knownLocation, onDone }: Props) {
  const form = useForm<DeliveryChoice>({
    delivery_method: delivery.method ?? '',
    area_id: delivery.area_id ? String(delivery.area_id) : '',
    fee: delivery.fee_pesewas > 0 ? delivery.fee : '',
    address: delivery.address ?? knownLocation ?? '',
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
          form.setData(value)
          form.clearErrors()
        }}
        areas={areas}
        errors={errors}
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
