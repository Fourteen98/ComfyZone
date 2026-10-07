import SelectField from '@/components/ui/SelectField'
import TextField from '@/components/ui/TextField'

// An exact place, with its usual delivery fee. region is null abroad.
export type Place = { id: number; country: string; region: string | null; name: string; fee: string; fee_pesewas: number }
// What the picker needs (location_options in the location_picker concern).
// `home` is the country that has regions here, and the default: Ghana.
export type Locations = { countries: string[]; home: string; regions: string[]; places: Place[] }
// What it produces. All plain text: Rails finds the place, or adds it.
export type Where = { country: string; region: string; place: string }

// "Nothing said yet": at home, region and place unknown.
export const nowhere = (home: string): Where => ({ country: home, region: '', place: '' })

// Has she actually told us anything? Home with no region hasn't.
export const said = (locations: Locations, where: Where) => where.country !== locations.home || where.region !== ''

// The known place matching what is typed, if there is one.
export function findPlace(locations: Locations, where: Where): Place | undefined {
  const name = where.place.trim().toLowerCase()
  const region = where.country === locations.home ? where.region : null
  return locations.places.find(
    (place) => place.country === where.country && (place.region ?? null) === (region || null) && place.name.toLowerCase() === name,
  )
}

type Props = {
  value: Where
  /** Also given the known place she landed on, if any (for its usual fee). */
  onChange: (value: Where, known?: Place) => void
  locations: Locations
  /** Keeps ids unique if two of these are on one page. */
  name?: string
  errors?: Record<string, string[] | undefined>
  /** On the public shop: worded for the person themselves ("your region"),
      and a place she doesn't have yet is NOT added to her list. */
  shopper?: boolean
}

// Where someone is: the country, then (at home) one of Ghana's regions,
// then the exact place.
//
// Country and region are fixed lists. The place is a text box that SUGGESTS
// the places already known there (a <datalist>), but accepts anything: a
// place typed for the first time is added when the form is saved. So the
// list grows as she works, and nobody has to set it up first.
//
// Abroad there is no region: just the country and a city.
export default function LocationFields({ value, onChange, locations, name = 'where', errors = {}, shopper = false }: Props) {
  const atHome = value.country === locations.home
  const here = locations.places.filter((place) => place.country === value.country && (!atHome || place.region === value.region))
  const typed = value.place.trim()
  const known = findPlace(locations, value)
  // At home the place waits for a region; abroad it only needs the country.
  const placeOpen = atHome ? value.region !== '' : true

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={atHome ? 'sm:col-span-2' : ''}>
        <SelectField
          id={`${name}_country`}
          label="Country"
          options={locations.countries.map((country) => ({ value: country, label: country }))}
          value={value.country}
          // Region and place belong to the country, so changing it clears them.
          onChange={(e) => onChange({ country: e.target.value || locations.home, region: '', place: '' })}
          error={errors.country}
        />
      </div>
      {atHome && (
        <SelectField
          id={`${name}_region`}
          label="Region"
          placeholder={shopper ? 'Choose your region' : 'Not known'}
          options={locations.regions.map((region) => ({ value: region, label: region }))}
          value={value.region}
          onChange={(e) => onChange({ ...value, region: e.target.value, place: '' })}
          error={errors.region}
        />
      )}
      <div>
        <TextField
          id={`${name}_place`}
          label={shopper ? 'Town or area' : atHome ? 'Exact place' : 'City or area'}
          list={`${name}_places`}
          autoComplete="off"
          maxLength={40}
          disabled={!placeOpen}
          placeholder={!placeOpen ? 'Choose the region first' : atHome ? 'e.g. East Legon' : 'e.g. Guangzhou'}
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
        {!shopper && typed !== '' && !known && (
          <p className="mt-1.5 text-sm text-taupe-700">New place. It will be added to {atHome ? value.region : value.country}.</p>
        )}
      </div>
    </div>
  )
}
