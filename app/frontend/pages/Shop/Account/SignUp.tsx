import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import ShopLayout from '@/layouts/ShopLayout'
import AuthCard from '@/components/shop/AuthCard'
import Button from '@/components/ui/Button'
import PasswordField from '@/components/ui/PasswordField'
import PhoneField from '@/components/ui/PhoneField'
import TextField from '@/components/ui/TextField'

// Props from Shop::AccountsController#new. `start`: they just ordered as a
// guest and came from that order's page; it joins the new account.
type Props = { start: { name: string; phone: string; order: string } | null }

// Signing up: name, phone, password. Optional: nobody has to, to order.
export default function ShopSignUp({ start }: Props) {
  const form = useForm({ name: start?.name ?? '', phone: start?.phone ?? '', email: '', password: '', order: start?.order ?? '' })
  const errors = form.errors as Record<string, string | string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ account: data }))
    form.post('/signup', { onError: () => form.reset('password') }) // -> Shop::AccountsController#create
  }

  return (
    <ShopLayout>
      <Head title="Sign up" />
      <AuthCard
        title="Create your account"
        lead={start ? 'Keep track of this order and check out faster next time.' : 'See your orders in one place and check out faster.'}
      >
        <form onSubmit={submit} className="space-y-5">
          <TextField
            id="name"
            label="Your name"
            required
            maxLength={60}
            autoComplete="name"
            value={form.data.name}
            onChange={(e) => form.setData('name', e.target.value)}
            error={errors.name}
          />
          <PhoneField
            id="phone"
            label="Phone number"
            required
            value={form.data.phone}
            onChange={(phone) => form.setData('phone', phone)}
            error={errors.phone}
            hint="You log in with this number."
          />
          <PasswordField
            id="password"
            label="Choose a password"
            autoComplete="new-password"
            value={form.data.password}
            onChange={(value) => form.setData('password', value)}
            error={errors.password}
            hint="At least 8 characters."
          />
          <TextField
            id="email"
            label="Email (optional)"
            type="email"
            autoComplete="email"
            value={form.data.email}
            onChange={(e) => form.setData('email', e.target.value)}
            error={errors.email}
          />
          <Button type="submit" block disabled={form.processing}>
            Sign up
          </Button>
          <p className="text-sm text-taupe-700">
            You'll stay logged in on this phone. In My account you can add Face ID or your fingerprint, so you never type the password. See
            our{' '}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
        </form>
        <p className="mt-5 text-sm">
          <Link href="/login" className="font-medium text-wine-800 underline underline-offset-4">
            Already have an account? Log in
          </Link>
        </p>
      </AuthCard>
    </ShopLayout>
  )
}
