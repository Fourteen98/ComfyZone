import { Head, Link } from '@inertiajs/react'
import ShopLayout from '@/layouts/ShopLayout'

// How to have your data deleted. Meta asks for the address of this page in
// the WhatsApp app's settings ("Data deletion instructions URL").
export default function DataDeletion({ contact_email }: { contact_email: string }) {
  return (
    <ShopLayout>
      <Head title="Delete your data" />
      <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed sm:px-6">
        <h1 className="font-display text-4xl font-semibold text-wine-800 sm:text-5xl">Delete your data</h1>
        <p className="mt-3 text-taupe-900">
          You can ask The Comfy Zone by Fazy to delete the information we hold about you: your name, phone number and username, your
          delivery details, your requests to be told when something is back, and your WhatsApp messages with our shop. Your past orders stay
          in our sales records, with nothing left that identifies you.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-wine-800">How to ask</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-taupe-900">
          <li>
            <strong>On WhatsApp:</strong> send <strong>"delete my data"</strong> to our WhatsApp shop, from the number you used with us.
            That way we know the request comes from you.
          </li>
          <li>
            <strong>Or by email:</strong> write to{' '}
            <a
              href={`mailto:${contact_email}?subject=Delete%20my%20data`}
              className="font-medium text-wine-800 underline underline-offset-4"
            >
              {contact_email}
            </a>{' '}
            with the subject "Delete my data", and give the phone number you used with us.
          </li>
        </ol>

        <h2 className="mt-8 font-display text-2xl font-semibold text-wine-800">What happens next</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-taupe-900">
          <li>We confirm we have your request.</li>
          <li>If you have an order in progress, we finish or cancel it with you first.</li>
          <li>
            We erase your details and messages, and confirm when it's done, as soon as we can and within one month. Payment records the law
            requires us to keep (for business and tax) are kept only as long as required, and used for nothing else.
          </li>
        </ul>

        <p className="mt-8 text-taupe-700">
          More about how we handle your information is in our{' '}
          <Link href="/privacy" className="font-medium text-wine-800 underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </article>
    </ShopLayout>
  )
}
