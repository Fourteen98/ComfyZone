import { router } from '@inertiajs/react'
import { Check, Copy, Globe, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import { confirmAction } from '@/lib/confirm'

export type ShopAccountInfo = {
  since: string
  last_login: string | null
  passkeys: number
  orders: number
  same_phone: boolean // logs in with the phone on this customer
  phone: string // the phone they log in with
} | null

type Props = {
  customerId: number
  name: string
  phone: string | null // the customer's, for "Send on WhatsApp"
  account: ShopAccountInfo
  /** A "set a new password" link just made (shown once). */
  resetLink: string | null
  canManage: boolean
}

// A customer's login on the website, from the back office: when they made
// it, and help when they forget the password (a one-time link to send them).
export default function ShopAccountPanel({ customerId, name, phone, account, resetLink, canManage }: Props) {
  const [copied, setCopied] = useState(false)
  if (!account) return null

  const first = name.split(' ')[0]
  const whatsapp =
    resetLink && phone
      ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Hi ${first}, here is your link to set a new password for The Comfy Zone website. It works once, for one day: ${resetLink}`,
        )}`
      : null

  async function remove() {
    const sure = await confirmAction(`Remove ${first}'s website account? They can sign up again. Their orders stay.`, {
      confirm: 'Remove account',
      danger: true,
    })
    if (sure) router.delete(`/admin/customers/${customerId}/shop_account`) // -> Customers::ShopAccountsController#destroy
  }

  return (
    <section className="mt-6 rounded-lg border border-taupe-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-medium">
        <Globe className="size-5 text-wine-800" aria-hidden="true" />
        Website account
      </h2>
      <p className="mt-1 text-sm text-taupe-700">
        Signed up {account.since}. {account.last_login ? `Last logged in ${account.last_login}.` : ''} {account.orders}{' '}
        {account.orders === 1 ? 'order' : 'orders'} placed while logged in.{' '}
        {account.passkeys > 0 ? `Uses Face ID or fingerprint on ${account.passkeys} ${account.passkeys === 1 ? 'device' : 'devices'}.` : ''}
      </p>
      {!account.same_phone && <p className="mt-1 text-sm text-amber-900">Logs in with {account.phone}.</p>}

      {resetLink && (
        <div className="mt-3 rounded-md bg-emerald-50 p-3">
          <p className="text-sm text-emerald-950">
            Send this to {first}. Check the request came from {account.phone} first: whoever opens it can set the password.
          </p>
          <p className="mt-2 font-mono text-xs break-all text-ink">{resetLink}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-wine-800 px-3 text-sm font-medium text-taupe-50 hover:bg-wine-700"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Send on WhatsApp
              </a>
            )}
            <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(resetLink).then(() => setCopied(true))}>
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => router.post(`/admin/customers/${customerId}/shop_account/reset_link`)}>
            Forgot password: make a link
          </Button>
          <Button type="button" variant="danger" onClick={remove}>
            Remove account
          </Button>
        </div>
      )}
    </section>
  )
}
