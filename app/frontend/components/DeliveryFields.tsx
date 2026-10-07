import { Bike, Store } from 'lucide-react'
import ChoiceCards from '@/components/ui/ChoiceCards'
import MoneyField from '@/components/ui/MoneyField'
import SelectField from '@/components/ui/SelectField'
import TextAreaField from '@/components/ui/TextAreaField'

// A place she delivers to (Settings > Delivery areas). `fee` is the usual
// fee as text for a money box ("25"); fee_pesewas is the same as a number.
export type DeliveryArea = { id: number; name: string; fee: string; fee_pesewas: number }

export type DeliveryChoice = {
  delivery_method: 'pickup' | 'delivery' | '' // '' = not decided yet
  area_id: string
  fee: string
  address: string
}

export const noDelivery: DeliveryChoice = { delivery_method: '', area_id: '', fee: '', address: '' }

type Props = {
  value: DeliveryChoice
  onChange: (value: DeliveryChoice) => void
  areas: DeliveryArea[]
  /** Keeps the radio buttons apart if two of these are ever on one page. */
  name?: string
  errors?: Record<string, string[] | undefined>
}

// "Will they collect it, or is it being sent?" and, if sent, where and for
// how much. Used when recording a sale and on the order page, so both ask
// in exactly the same way. It holds no state: the form that uses it does.
export default function DeliveryFields({ value, onChange, areas, name = 'delivery_method', errors = {} }: Props) {
  function pickArea(area_id: string) {
    const area = areas.find((a) => String(a.id) === area_id)
    // Choosing an area fills in its usual fee. She can still change it.
    onChange({ ...value, area_id, fee: area ? (area.fee_pesewas > 0 ? area.fee : '') : value.fee })
  }

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
          {/* With no areas set up yet, she just types the fee. */}
          {areas.length > 0 && (
            <SelectField
              id={`${name}_area`}
              label="Where to"
              placeholder="Somewhere else"
              options={areas.map((area) => ({ value: String(area.id), label: area.name }))}
              value={value.area_id}
              onChange={(e) => pickArea(e.target.value)}
            />
          )}
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
