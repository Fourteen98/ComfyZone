import { Head, useForm, usePage } from '@inertiajs/react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AuthShell from '@/components/AuthShell'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'

// Props from PasswordsController#edit. `token` came in the emailed link; it
// proves who this is, and goes back in the URL when the form is sent.
export default function EditPassword({ token }: { token: string }) {
  const { flash } = usePage()
  const [show, setShow] = useState(false)
  const form = useForm({ password: '', password_confirmation: '' })

  function submit(event: FormEvent) {
    event.preventDefault()
    // One box, not two: with "Show" she can see what she typed, which is a
    // better check than typing it blind twice. Rails still gets both fields.
    form.transform((data) => ({ ...data, password_confirmation: data.password }))
    form.put(`/admin/passwords/${token}`) // -> PasswordsController#update
  }

  return (
    <AuthShell title="Choose a new password" lead="At least 8 characters. You will log in with it from now on.">
      <Head title="Choose a new password" />

      <form onSubmit={submit} className="mt-8 space-y-5">
        {flash.alert && <Alert tone="error">{flash.alert}</Alert>}

        <TextField
          id="password"
          label="New password"
          type={show ? 'text' : 'password'}
          required
          minLength={8}
          maxLength={72}
          autoFocus
          autoComplete="new-password"
          value={form.data.password}
          onChange={(e) => form.setData('password', e.target.value)}
          error={form.errors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-pressed={show}
              className="rounded px-2 py-1.5 text-sm font-medium text-wine-700 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          }
        />

        <Button type="submit" block disabled={form.processing}>
          {form.processing ? 'Saving…' : 'Save and go to log in'}
        </Button>
      </form>
    </AuthShell>
  )
}
