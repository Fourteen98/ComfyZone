import { Head, router, usePage } from '@inertiajs/react'
import { Fingerprint } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import TextField from '@/components/ui/TextField'
import { guessDeviceName, passkeysSupported, registerPasskey } from '@/lib/passkeys'
import { confirmAction } from '@/lib/confirm'
import InstallApp from '@/components/InstallApp'
import PushSettings from '@/components/PushSettings'
import type { PushProps } from '@/components/PushSettings'

type Passkey = {
  id: number
  name: string
  created_at: string
  last_used_at: string | null
}

// Props from AccountsController#show
// `push` is null until the server has been given its notification keys.
export default function AccountShow({ passkeys, push }: { passkeys: Passkey[]; push: PushProps | null }) {
  const user = usePage().props.auth.user!
  const supported = passkeysSupported()

  const [name, setName] = useState(guessDeviceName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const problem = await registerPasskey(name)

    setBusy(false)
    if (problem) {
      setError(problem)
    } else {
      // Ask Rails for this page again so the list (and the flash message
      // it set) show up. Inertia swaps in the new props without a full reload.
      router.reload()
    }
  }

  async function remove(passkey: Passkey) {
    if (!(await confirmAction(`Remove "${passkey.name}"? That device will need your password to log in.`, { confirm: 'Remove', danger: true }))) return
    router.delete(`/admin/account/passkeys/${passkey.id}`) // -> Account::PasskeysController#destroy
  }

  return (
    <AppLayout>
      <Head title="My account" />

      <PageHeader title="My account" description={`${user.name}, ${user.role}. ${user.email_address}`} />

      <div className="mt-6 max-w-3xl">
        <div className="mb-6">
          <InstallApp />
        </div>

        {push && (
          <div className="mb-6">
            <PushSettings push={push} />
          </div>
        )}

        <Panel title="Passkeys">
          <p className="text-taupe-700">
            Log in with Face ID, your fingerprint or your screen lock instead of typing a password. Set one up on
            each device you use. Your password still works as a backup.
          </p>

          {passkeys.length === 0 ? (
            <EmptyState icon={Fingerprint} title="No passkeys yet">
              Add one below while you are on the phone or computer you want to log in from.
            </EmptyState>
          ) : (
            <ul className="mt-4 divide-y divide-taupe-200 rounded-lg border border-taupe-200">
              {passkeys.map((passkey) => (
                <li key={passkey.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <Fingerprint className="size-6 text-wine-700" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{passkey.name}</p>
                    <p className="text-sm text-taupe-700">
                      Added {passkey.created_at}.{' '}
                      {passkey.last_used_at ? `Last used ${passkey.last_used_at}.` : 'Not used yet.'}
                    </p>
                  </div>
                  <Button type="button" variant="danger" className="min-h-10! px-3!" onClick={() => remove(passkey)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {supported ? (
            <form onSubmit={add} className="mt-5 border-t border-taupe-200 pt-5">
              {error && (
                <div className="mb-4">
                  <Alert tone="error">{error}</Alert>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1">
                  <TextField
                    id="passkey_name"
                    label="Name for this device"
                    required
                    maxLength={40}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  <Fingerprint className="size-5" aria-hidden="true" />
                  {busy ? 'Waiting for your device…' : 'Add a passkey'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-5">
              <Alert tone="error">This browser can't use passkeys. Try Safari or Chrome on your phone.</Alert>
            </div>
          )}
        </Panel>
      </div>
    </AppLayout>
  )
}
