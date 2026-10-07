import { Head, Link, useForm, usePage } from '@inertiajs/react'
import type { FormEvent } from 'react'
import AuthShell from '@/components/AuthShell'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'

// Props from PasswordsController#new.
// `sending` is false until a mail server has been set up on the server
// (see config/environments/production.rb). Without one there is no point
// offering a form that can't do anything, so the page says who to ask.
export default function NewPassword({ sending }: { sending: boolean }) {
  const { flash } = usePage()
  const form = useForm({ email_address: '' })

  function submit(event: FormEvent) {
    event.preventDefault()
    form.post('/admin/passwords') // -> PasswordsController#create
  }

  return (
    <AuthShell title="Forgot your password?" lead={sending ? 'We will email you a link to choose a new one.' : 'Here is how to get back in.'}>
      <Head title="Forgot your password" />

      <div className="mt-8 space-y-5">
        {flash.alert && <Alert tone="error">{flash.alert}</Alert>}

        {sending ? (
          <form onSubmit={submit} className="space-y-5">
            <TextField
              id="email_address"
              label="Your email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={form.data.email_address}
              onChange={(e) => form.setData('email_address', e.target.value)}
            />
            <Button type="submit" block disabled={form.processing}>
              {form.processing ? 'Sending…' : 'Email me a reset link'}
            </Button>
          </form>
        ) : (
          <p className="rounded-lg bg-taupe-100 p-4 text-taupe-800">
            Ask the shop owner to set a new password for you. They can do it in Settings, under People, and tell you what it is.
          </p>
        )}

        <p className="text-sm">
          <Link href="/admin/session/new" className="text-taupe-700 underline decoration-taupe-400 underline-offset-4 hover:text-wine-800">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
