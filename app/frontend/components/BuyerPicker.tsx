import { Search, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'

export type Buyer = {
  id: number
  handle: string | null
  name: string | null
  phone: string | null
  location: string | null // street or landmark
  region: string | null // where they usually are
  place: string | null
}

// Who is buying, as sent to Rails (OrdersController#buyer):
//   { id }                     someone she picked from her customers
//   { name, phone, handle }    someone new, with whatever she knows
export type BuyerChoice = { id: number } | { name: string; phone: string; handle: string }

type Props = {
  buyers: Buyer[]
  /** Ask for the username first (a social channel) or the name first. */
  usernameFirst: boolean
  /** Only pick from the list; don't offer to add someone new. */
  searchOnly?: boolean
  /** Tells the parent who is chosen (null = nobody yet), what to call them,
      and the known customer behind the choice, if there is one. */
  onChange: (choice: BuyerChoice | null, label: string, known?: Buyer) => void
}

const digits = (text: string) => text.replace(/\D/g, '')

export function buyerLabel(buyer: Buyer): string {
  return buyer.name ?? (buyer.handle ? `@${buyer.handle}` : (buyer.phone ?? ''))
}

// Choosing the buyer for a sale recorded by hand. Three states:
//
//   searching  one box that looks through names, usernames and phone numbers
//   picked     a known customer is chosen (shown as a card with "Change")
//   adding     a small form for someone new
//
// The parent remounts this (with `key`) after each sale, which is how it
// goes back to an empty search box.
export default function BuyerPicker({ buyers, usernameFirst, searchOnly = false, onChange }: Props) {
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Buyer | null>(null)
  const [fresh, setFresh] = useState<{ name: string; phone: string; handle: string } | null>(null)

  const term = search.trim().toLowerCase().replace(/^@/, '')
  const termDigits = digits(term)
  const matches = term
    ? buyers
        .filter(
          (buyer) =>
            buyer.name?.toLowerCase().includes(term) ||
            buyer.handle?.includes(term) ||
            // Only compare as a phone number once a few digits are typed.
            (termDigits.length >= 3 && buyer.phone && digits(buyer.phone).includes(termDigits)),
        )
        .slice(0, 6)
    : []

  function pick(buyer: Buyer) {
    setPicked(buyer)
    onChange({ id: buyer.id }, buyerLabel(buyer), buyer)
  }

  function startOver() {
    setPicked(null)
    setFresh(null)
    onChange(null, '')
  }

  // Start the new-buyer form from what she already typed, guessing which
  // box it belongs in: mostly digits is a phone number, an @ or a single
  // word on a social channel is a username, anything else is a name.
  function addNew() {
    const typed = search.trim()
    const start = { name: '', phone: '', handle: '' }
    if (typed.startsWith('@') || (usernameFirst && typed !== '' && !/\s/.test(typed) && !/^\+?[\d\s]+$/.test(typed))) {
      start.handle = typed.replace(/^@/, '')
    } else if (/^\+?[\d\s-]{6,}$/.test(typed)) {
      start.phone = typed
    } else {
      start.name = typed
    }
    update(start)
  }

  function update(next: { name: string; phone: string; handle: string }) {
    setFresh(next)
    const known = next.name.trim() || next.handle.trim() || next.phone.trim()
    const label = next.name.trim() || (next.handle.trim() ? `@${next.handle.trim().replace(/^@/, '')}` : next.phone.trim())
    onChange(known ? next : null, label)
  }

  // ----- picked -----
  if (picked) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-wine-800 bg-wine-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{buyerLabel(picked)}</p>
          <p className="truncate text-sm text-taupe-700">
            {[picked.name && picked.handle ? `@${picked.handle}` : null, picked.phone].filter(Boolean).join(', ') || 'Bought from you before'}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={startOver}>
          Change
        </Button>
      </div>
    )
  }

  // ----- adding someone new -----
  if (fresh) {
    const username = (
      <TextField
        id="buyer_handle"
        label="Username (if they have one)"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        placeholder="without the @"
        value={fresh.handle}
        onChange={(e) => update({ ...fresh, handle: e.target.value })}
      />
    )

    return (
      <div className="space-y-4 rounded-lg border border-taupe-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">New buyer</p>
          <button
            type="button"
            onClick={startOver}
            aria-label="Back to search"
            className="flex size-10 items-center justify-center rounded-md text-taupe-600 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {usernameFirst && username}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="buyer_name"
            label="Name"
            autoComplete="off"
            maxLength={60}
            value={fresh.name}
            onChange={(e) => update({ ...fresh, name: e.target.value })}
          />
          <TextField
            id="buyer_phone"
            label="Phone number"
            type="tel"
            autoComplete="off"
            maxLength={25}
            placeholder="e.g. 024 123 4567"
            value={fresh.phone}
            onChange={(e) => update({ ...fresh, phone: e.target.value })}
          />
        </div>
        {!usernameFirst && username}
        <p className="text-sm text-taupe-700">Fill in what you know. One of them is enough.</p>
      </div>
    )
  }

  // ----- searching -----
  return (
    <div>
      <label htmlFor="buyer_search" className="block text-sm font-medium text-taupe-800">
        {searchOnly ? 'Find the other one' : 'Who is buying?'}
      </label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute top-4 left-3.5 size-5 text-taupe-500" aria-hidden="true" />
        <input
          id="buyer_search"
          type="search"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="Name, phone number or username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block min-h-14 w-full rounded-md border-taupe-300 bg-white pr-3.5 pl-11 text-lg placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
        />
      </div>

      {matches.length > 0 && (
        <ul className="mt-2 divide-y divide-taupe-200 overflow-hidden rounded-lg border border-taupe-200 bg-white">
          {matches.map((buyer) => (
            <li key={buyer.id}>
              <button
                type="button"
                onClick={() => pick(buyer)}
                className="flex min-h-12 w-full flex-wrap items-baseline gap-x-3 px-4 py-2 text-left hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
              >
                <span className="font-medium">{buyerLabel(buyer)}</span>
                <span className="text-sm text-taupe-700">
                  {[buyer.name && buyer.handle ? `@${buyer.handle}` : null, buyer.phone].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searchOnly && (
        <Button type="button" variant="secondary" className="mt-3" onClick={addNew}>
          <UserPlus className="size-5" aria-hidden="true" />
          {term ? `Add "${search.trim()}" as a new buyer` : 'Add a new buyer'}
        </Button>
      )}
    </div>
  )
}
