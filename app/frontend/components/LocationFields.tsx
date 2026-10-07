import SelectField from '@/components/ui/SelectField'
import TextField from '@/components/ui/TextField'

// An exact place within a region, with its usual delivery fee.
export type Place = { id: number; region: string; name: string; fee: string; fee_pesewas: number }
// What the picker needs (location_options in the sale_capture concern).
export type Locations = { regions: string[]; places: Place[] }
// What it produces. Both are plain text: Rails finds the place, or adds it.
export type Where = { region: string; place: string }

export const nowhere: Where = { region: '', place: '' }

// The known place matching what is typed, if there is one.
export function findPlace(locations: Locations, where: Where): Place | undefined {
  const name = where.place.trim().toLowerCase()
  return locations.places.find((place) => place.region === where.region && place.name.toLowerCase() === name)
}

type Props = {
  value: Where
  /** Also given the known place she landed on, if any (for its usual fee). */
  onChange: (value: Where, known?: Place) => void
  locations: Locations
  /** Keeps ids unique if two of these are on one page. */
  name?: string
  errors?: Record<string, string[] | undefined>
}

// Where someone is: one of Ghana's regions, then the exact place.
//
// The region is a fixed list. The place is a text box that SUGGESTS the
// places already known in that region (a <datalist>), but accepts anything:
// a place typed for the first time is added when the form is saved. So the
// list grows as she works, and nobody has to set it up first.
export default function LocationFields({ value, onChange, locations, name = 'where', errors = {} }: Props) {
  const here = locations.places.filter((place) => place.region === value.region)
  const typed = value.place.trim()
  const known = findPlace(locations, value)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        id={`${name}_region`}
        label="Region"
        placeholder="Not known"
        options={locations.regions.map((region) => ({ value: region, label: region }))}
        value={value.region}
        // A place belongs to its region, so changing region clears it.
        onChange={(e) => onChange({ region: e.target.value, place: '' })}
        error={errors.region}
      />
      <div>
        <TextField
          id={`${name}_place`}
          label="Exact place"
          list={`${name}_places`}
          autoComplete="off"
          maxLength={40}
          disabled={value.region === ''}
          placeholder={value.region === '' ? 'Choose the region first' : 'e.g. East Legon'}
          value={value.place}
          onChange={(e) => {
            const next = { ...value, place: e.target.value }
            onChange(next, findPlace(locations, next))
          }}
        />
        <datalist id={`${name}_places`}>
          {here.map((place) => (
            <option key={place.id} value={place.name} />
          ))}
        </datalist>
        {typed !== '' && !known && <p className="mt-1.5 text-sm text-taupe-700">New place. It will be added to {value.region}.</p>}
      </div>
    </div>
  )
}
