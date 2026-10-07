import { Bike, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import ChoiceCards from '@/components/ui/ChoiceCards'
import MoneyField from '@/components/ui/MoneyField'
import TextAreaField from '@/components/ui/TextAreaField'

export type DeliveryChoice = {
  delivery_method: 'pickup' | 'delivery' | '' // '' = not decided yet
  fee: string
  address: string
}

export const noDelivery: DeliveryChoice = { delivery_method: '', fee: '', address: '' }

type Props = {
  value: DeliveryChoice
  onChange: (value: DeliveryChoice) => void
  /** Shown first when it is being sent: the region and place picker, on
      screens that don't already ask where the buyer is. */
  where?: ReactNode
  /** Keeps the radio buttons apart if two of these are ever on one page. */
  name?: string
  errors?: Record<string, string[] | undefined>
}

// "Will they collect it, or is it being sent?" and, if sent, for how much
// and to what address. Used when recording a sale and on the order page, so
// both ask in exactly the same way. It holds no state: the form that uses
// it does.
export default function DeliveryFields({ value, onChange, where, name = 'delivery_method', errors = {} }: Props) {
  return (
    <div className="space-y-4">
      <ChoiceCards
        legend="How will they get it?"
        name={name}
        choices={[
          { value: 'pickup', label: 'They collect it', icon: Store },
          { value: 'delivery', label: 'It is sent to them', icon: Bike },
        ]}
        value={value.delivery_method}
        onChange={(delivery_method) => onChange({ ...value, delivery_method })}
        error={errors.delivery_method}
      />

      {value.delivery_method === 'delivery' && (
        <>
          {where}
          <MoneyField
            id={`${name}_fee`}
            label="What they pay for delivery"
            hint="Added to what they owe. Leave empty if delivery is free."
            value={value.fee}
            onChange={(e) => onChange({ ...value, fee: e.target.value })}
            error={errors.delivery_fee}
          />
          <TextAreaField
            id={`${name}_address`}
            label="Address or landmark"
            rows={2}
            placeholder="Street, landmark, and a number the rider can call"
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            error={errors.delivery_address}
          />
        </>
      )}
    </div>
  )
}
