import { Head, Link, router, useForm } from '@inertiajs/react'
import { ChevronRight, Fingerprint, LogOut, Package } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import ShopLayout from '@/layouts/ShopLayout'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import PasswordField from '@/components/ui/PasswordField'
import PhoneField from '@/components/ui/PhoneField'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'
import { formatMoney } from '@/lib/format'
import { SHOP, guessDeviceName, passkeysSupported, registerPasskey } from '@/lib/passkeys'

type Status = 'claimed' | 'paid' | 'packed' | 'delivered' | 'cancelled' | 'returned'

// Props from Shop::AccountsController#show
type Props = {
  account: { name: string; phone: string; email: string; since: string }
  orders: {
    token: string
    number: number
    at: string
    status: Status
    total_pesewas: number
    balance_pesewas: number // > 0: still to pay
    items: number
    summary: string // the first product names
  }[]
  passkeys: { id: number; name: string; added: string; used: string | null }[]
  devices: number // logged in on this many devices
}

// The same stages as the order page, in shoppers' words.
const words: Record<Status, string> = {
  claimed: 'Received',
  paid: 'Received, paid',
  packed: 'Being prepared',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
}

// "My account": their website orders, details, Face ID / fingerprint,
// password, logging out, and deleting the account.
export default function ShopAccount({ account, orders, passkeys, devices }: Props) {
  const first = account.name.split(' ')[0]

  return (
    <ShopLayout>
      <Head title="My account" />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-wine-800 sm:text-5xl">Hi {first}</h1>
          <p className="mt-1 text-taupe-700">
            {account.phone}. With us since {account.since}.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => router.delete('/logout')}>
          <LogOut className="size-5" aria-hidden="true" />
          Log out
        </Button>
      </div>

      <Section title="My orders">
        {orders.length === 0 ? (
          <p className="text-taupe-700">
            No orders yet.{' '}
            <Link href="/" className="font-medium text-wine-800 underline underline-offset-4">
              Have a look at what's new
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-taupe-200 overflow-hidden rounded-xl border border-taupe-200 bg-white">
            {orders.map((order) => (
              <li key={order.token}>
                <Link href={`/order/${order.token}`} className="flex items-center gap-3 px-4 py-3 hover:bg-taupe-50">
                  <Package className="size-6 shrink-0 text-wine-700" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">Order {order.number}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(order.total_pesewas)}</span>
                    </span>
                    <span className="block truncate text-sm text-taupe-700">
                      {order.at} · {words[order.status]}
                      {order.balance_pesewas > 0 && order.status !== 'cancelled' && ` · ${formatMoney(order.balance_pesewas)} to pay`}
                    </span>
                    <span className="block truncate text-sm text-taupe-600">
                      {order.items} {order.items === 1 ? 'piece' : 'pieces'}: {order.summary}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-taupe-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-taupe-600">Orders you place on this website while logged in.</p>
      </Section>

      <Section title="Face ID and fingerprint">
        <Passkeys passkeys={passkeys} />
      </Section>

      <Section title="Your details">
        <Details account={account} />
      </Section>

      <Section title="Password">
        <ChangePassword devices={devices} />
      </Section>

      <Section title="Delete my account">
        <DeleteAccount />
      </Section>
    </ShopLayout>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-2xl font-semibold text-wine-800">{title}</h2>
      {children}
    </section>
  )
}

// Passkeys: log in with a tap instead of typing the password.
function Passkeys({ passkeys }: { passkeys: Props['passkeys'] }) {
  const [name, setName] = useState(guessDeviceName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const problem = await registerPasskey(name, SHOP.register)
    setBusy(false)
    if (problem) setError(problem)
    else router.reload() // the new one, and its flash message
  }

  async function remove(passkey: Props['passkeys'][number]) {
    if (
      !(await confirmAction(`Remove "${passkey.name}"? That phone will need your password to log in.`, { confirm: 'Remove', danger: true }))
    )
      return
    router.delete(`/account/passkeys/${passkey.id}`) // -> Shop::PasskeysController#destroy
  }

  return (
    <div className="rounded-xl border border-taupe-200 bg-white p-4 sm:p-5">
      <p className="text-taupe-800">Log in with Face ID, your fingerprint or your phone's screen lock, instead of typing your password.</p>
      {passkeys.length > 0 && (
        <ul className="mt-4 divide-y divide-taupe-200 rounded-lg border border-taupe-200">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <Fingerprint className="size-5 text-wine-700" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{passkey.name}</span>
                <span className="block text-sm text-taupe-600">
                  Added {passkey.added}. {passkey.used ? `Last used ${passkey.used}.` : 'Not used yet.'}
                </span>
              </span>
              <Button type="button" variant="danger" className="min-h-10! px-3!" onClick={() => remove(passkey)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {passkeysSupported() ? (
        <form onSubmit={add} className="mt-4">
          {error && (
            <div className="mb-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44 flex-1">
              <TextField
                id="passkey_name"
                label="Name for this phone"
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              <Fingerprint className="size-5" aria-hidden="true" />
              {busy ? 'Waiting for your phone…' : passkeys.length ? 'Add this phone' : 'Set it up'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-taupe-700">This browser can't do this. Try Chrome or Safari on your phone.</p>
      )}
    </div>
  )
}

function Details({ account }: { account: Props['account'] }) {
  const form = useForm({ name: account.name, phone: account.phone, email: account.email })
  const errors = form.errors as Record<string, string | string[] | undefined>

  function save(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ account: data }))
    form.patch('/account', { preserveScroll: true }) // -> Shop::AccountsController#update
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-taupe-200 bg-white p-4 sm:p-5">
      <TextField
        id="account_name"
        label="Name"
        required
        maxLength={60}
        value={form.data.name}
        onChange={(e) => form.setData('name', e.target.value)}
        error={errors.name}
      />
      <PhoneField
        id="account_phone"
        label="Phone number (you log in with it)"
        required
        value={form.data.phone}
        onChange={(phone) => form.setData('phone', phone)}
        error={errors.phone}
      />
      <TextField
        id="account_email"
        label="Email (optional)"
        type="email"
        value={form.data.email}
        onChange={(e) => form.setData('email', e.target.value)}
        error={errors.email}
      />
      <Button type="submit" variant="secondary" disabled={form.processing || !form.isDirty}>
        Save
      </Button>
    </form>
  )
}

function ChangePassword({ devices }: { devices: number }) {
  const form = useForm({ current: '', new: '' })
  const errors = form.errors as Record<string, string | string[] | undefined>

  function save(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ password: data }))
    form.patch('/account', { preserveScroll: true, onFinish: () => form.reset() })
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-taupe-200 bg-white p-4 sm:p-5">
      <PasswordField
        id="current_password"
        label="Current password"
        autoComplete="current-password"
        value={form.data.current}
        onChange={(value) => form.setData('current', value)}
        error={errors.current_password}
      />
      <PasswordField
        id="new_password"
        label="New password"
        autoComplete="new-password"
        value={form.data.new}
        onChange={(value) => form.setData('new', value)}
        error={errors.new_password}
        hint="At least 8 characters."
      />
      <Button type="submit" variant="secondary" disabled={form.processing}>
        Change password
      </Button>
      <p className="text-sm text-taupe-600">
        You're logged in on {devices} {devices === 1 ? 'device' : 'devices'}. Changing the password logs out all the others.
      </p>
    </form>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const form = useForm({ password: '' })
  const errors = form.errors as Record<string, string | string[] | undefined>

  if (!open) {
    return (
      <div className="rounded-xl border border-taupe-200 bg-white p-4 sm:p-5">
        <p className="text-taupe-800">
          Removes your login. Orders you placed stay with the shop for its records. To have your personal details erased too, see{' '}
          <Link href="/data-deletion" className="underline underline-offset-4">
            delete your data
          </Link>
          .
        </p>
        <Button type="button" variant="danger" className="mt-3" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.delete('/account') // -> Shop::AccountsController#destroy
      }}
      className="space-y-4 rounded-xl border border-red-300 bg-red-50 p-4 sm:p-5"
    >
      <p className="text-red-950">Type your password to delete your account. This can't be undone.</p>
      <PasswordField
        id="delete_password"
        label="Password"
        autoComplete="current-password"
        value={form.data.password}
        onChange={(value) => form.setData('password', value)}
        error={errors.delete_password}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={form.processing}>
          Delete my account
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </form>
  )
}
