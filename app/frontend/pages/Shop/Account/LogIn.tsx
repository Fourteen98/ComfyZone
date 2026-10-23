import { Head, Link, router, useForm } from '@inertiajs/react'
import { Fingerprint } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import ShopLayout from '@/layouts/ShopLayout'
import AuthCard from '@/components/shop/AuthCard'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import PasswordField from '@/components/ui/PasswordField'
import PhoneField from '@/components/ui/PhoneField'
import { SHOP, loginWithPasskey, passkeysSupported } from '@/lib/passkeys'

// Logging in on the website: phone + password, or a passkey (Face ID,
// fingerprint) if they added one in My account. Shop::SessionsController.
export default function ShopLogIn() {
  const form = useForm({ phone: '', password: '' })
  const errors = form.errors as Record<string, string | string[] | undefined>
  const [busy, setBusy] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    form.post('/login', { onError: () => form.reset('password') }) // -> Shop::SessionsController#create
  }

  async function passkey() {
    setBusy(true)
    setPasskeyError(null)
    const result = await loginWithPasskey(SHOP.login)
    if ('error' in result) {
      setBusy(false)
      setPasskeyError(result.error)
    } else {
      router.visit(result.redirectTo)
    }
  }

  return (
    <ShopLayout>
      <Head title="Log in" />
      <AuthCard title="Welcome back" lead="Log in to see your orders and check out faster.">
        {passkeysSupported() && (
          <div className="mb-6 border-b border-taupe-200 pb-6">
            {passkeyError && (
              <div className="mb-3">
                <Alert tone="error">{passkeyError}</Alert>
              </div>
            )}
            <Button type="button" block onClick={passkey} disabled={busy}>
              <Fingerprint className="size-5" aria-hidden="true" />
              {busy ? 'Waiting for your phone…' : 'Log in with Face ID or fingerprint'}
            </Button>
            <p className="mt-2 text-center text-sm text-taupe-600">If you set it up in My account.</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          <PhoneField id="phone" label="Phone number" required value={form.data.phone} onChange={(phone) => form.setData('phone', phone)} />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            value={form.data.password}
            onChange={(value) => form.setData('password', value)}
            error={errors.password}
          />
          <Button type="submit" block variant={passkeysSupported() ? 'secondary' : 'primary'} disabled={form.processing}>
            Log in
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
          <Link href="/signup" className="font-medium text-wine-800 underline underline-offset-4">
            New here? Sign up
          </Link>
          <Link href="/forgot-password" className="font-medium text-wine-800 underline underline-offset-4">
            Forgot password?
          </Link>
        </div>
      </AuthCard>
      <p className="mt-6 text-center text-sm text-taupe-600">
        Staff?{' '}
        <a href="/admin/session/new" className="underline underline-offset-4">
          Log in to the back office
        </a>
      </p>
    </ShopLayout>
  )
}
