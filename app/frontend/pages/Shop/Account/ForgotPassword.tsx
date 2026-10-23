import { Head, Link } from '@inertiajs/react'
import { MessageCircle } from 'lucide-react'
import ShopLayout from '@/layouts/ShopLayout'
import AuthCard from '@/components/shop/AuthCard'

// Props from Shop::PasswordsController#new: the shop's WhatsApp, message
// written, or null if she hasn't set the number yet.
type Props = { whatsapp: string | null }

// No SMS codes: they message the shop, and get a link to set a new password.
export default function ForgotPassword({ whatsapp }: Props) {
  return (
    <ShopLayout>
      <Head title="Forgot password" />
      <AuthCard title="Forgot your password?" lead="No problem. We'll send you a link to set a new one.">
        <ol className="list-decimal space-y-2 pl-5 text-taupe-900">
          <li>Message us on WhatsApp from the phone number you signed up with.</li>
          <li>We send you a link. It works once, for one day.</li>
          <li>Open it, choose a new password, and you're logged in.</li>
        </ol>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-wine-800 px-4 font-medium text-taupe-50 hover:bg-wine-700"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            Message us on WhatsApp
          </a>
        ) : (
          <p className="mt-6 text-taupe-700">Message us on WhatsApp, or call the number you have for the shop.</p>
        )}
        <p className="mt-5 text-sm">
          <Link href="/login" className="font-medium text-wine-800 underline underline-offset-4">
            Back to log in
          </Link>
        </p>
      </AuthCard>
    </ShopLayout>
  )
}
