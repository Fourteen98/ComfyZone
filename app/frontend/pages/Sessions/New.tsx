import { Head, router, useForm, usePage } from '@inertiajs/react'
import { Fingerprint } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import logoWall from '@/assets/brand/logo-wall.jpg'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import { loginWithPasskey, passkeysSupported } from '@/lib/passkeys'

export default function NewSession() {
  const { flash } = usePage()
  const [showPassword, setShowPassword] = useState(false)

  // useForm holds the field values, sends them to Rails, and collects any
  // validation errors Rails sends back. It replaces `form_with` from ERB.
  const form = useForm({
    email_address: '',
    password: '',
  })

  // Passkey login: one tap, then Face ID or fingerprint. No typing.
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)

  async function passkeyLogin() {
    setPasskeyBusy(true)
    setPasskeyError(null)

    const result = await loginWithPasskey()

    if ('error' in result) {
      setPasskeyBusy(false)
      setPasskeyError(result.error)
    } else {
      // Rails has set the login cookie; now load the page it sent us to.
      router.visit(result.redirectTo)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    // POST /session -> SessionsController#create.
    // The CSRF token is attached automatically.
    form.post('/session', {
      // Never keep a typed password on screen after a failed attempt.
      onError: () => form.reset('password'),
    })
  }

  return (
    // Phone: the logo on top, the form below.
    // Desktop (lg and up): logo on the left, form on the right.
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Head title="Log in" />

      {/* The brand side. The logo photo is the whole panel; the background
          colour underneath matches the wall so nothing flashes while it loads. */}
      <div className="h-[42dvh] shrink-0 bg-taupe-500 lg:h-auto lg:w-[55%]">
        <img
          src={logoWall}
          alt="The Comfy Zone by Fazy. Comfort meets style."
          className="size-full object-cover object-[center_45%]"
        />
      </div>

      {/* The form side. */}
      <main className="flex flex-1 items-start justify-center px-6 py-10 lg:items-center lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-4xl font-semibold text-wine-800 lg:text-5xl">Welcome back</h1>
          <p className="mt-2 text-taupe-700">Log in to manage stock and sales.</p>

          {passkeysSupported() && (
            <div className="mt-8">
              {passkeyError && (
                <div className="mb-4">
                  <Alert tone="error">{passkeyError}</Alert>
                </div>
              )}
              <Button type="button" block onClick={passkeyLogin} disabled={passkeyBusy}>
                <Fingerprint className="size-5" aria-hidden="true" />
                {passkeyBusy ? 'Waiting for your device…' : 'Log in with a passkey'}
              </Button>
              <p className="mt-2 text-sm text-taupe-700">Face ID, fingerprint or screen lock.</p>

              <p className="mt-6 flex items-center gap-3 text-sm text-taupe-600">
                <span className="h-px flex-1 bg-taupe-200" />
                or use your password
                <span className="h-px flex-1 bg-taupe-200" />
              </p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-5">
            {flash.alert && <Alert tone="error">{flash.alert}</Alert>}
            {flash.notice && <Alert tone="success">{flash.notice}</Alert>}

            <TextField
              id="email_address"
              label="Email"
              type="email"
              required
              autoComplete="username"
              value={form.data.email_address}
              onChange={(e) => form.setData('email_address', e.target.value)}
              // Set by `inertia: { errors: ... }` in SessionsController#create
              error={form.errors.email_address}
            />

            <TextField
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              maxLength={72}
              autoComplete="current-password"
              value={form.data.password}
              onChange={(e) => form.setData('password', e.target.value)}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  className="rounded px-2 py-1.5 text-sm font-medium text-wine-700 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              }
            />

            {/* Secondary when a passkey button is on offer, so there is one
                clear main action on the page. */}
            <Button
              type="submit"
              block
              variant={passkeysSupported() ? 'secondary' : 'primary'}
              disabled={form.processing}
            >
              {form.processing ? 'Logging in…' : 'Log in'}
            </Button>
          </form>

          {/* A plain <a>, not <Link>: the password reset pages are still
              classic Rails ERB views, so we want a normal full page load. */}
          <p className="mt-6 text-sm">
            <a
              href="/passwords/new"
              className="text-taupe-700 underline decoration-taupe-400 underline-offset-4 hover:text-wine-800"
            >
              Forgot your password?
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
