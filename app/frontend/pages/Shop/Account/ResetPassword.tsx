import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import ShopLayout from '@/layouts/ShopLayout'
import AuthCard from '@/components/shop/AuthCard'
import Button from '@/components/ui/Button'
import PasswordField from '@/components/ui/PasswordField'

// Props from Shop::PasswordsController#edit (the link staff sent).
type Props = { token: string; name: string }

export default function ResetPassword({ token, name }: Props) {
  const form = useForm({ password: '' })
  const errors = form.errors as Record<string, string | string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.patch(`/reset-password/${token}`) // -> Shop::PasswordsController#update
  }

  return (
    <ShopLayout>
      <Head title="New password" />
      <AuthCard title={`Hi ${name}`} lead="Choose a new password for your account.">
        <form onSubmit={submit} className="space-y-5">
          <PasswordField
            id="password"
            label="New password"
            autoComplete="new-password"
            value={form.data.password}
            onChange={(value) => form.setData('password', value)}
            error={errors.password}
            hint="At least 8 characters."
          />
          <Button type="submit" block disabled={form.processing}>
            Save and log in
          </Button>
        </form>
      </AuthCard>
    </ShopLayout>
  )
}
