import { Head } from '@inertiajs/react'
import type { ReactNode } from 'react'
import ShopLayout from '@/layouts/ShopLayout'

// Props from Shop::PagesController#privacy
type Props = { updated: string; contact_email: string }

// The privacy policy, in plain words. It describes what the app actually
// does: change the text here (and PRIVACY_UPDATED in the controller) when
// what we collect or who we share it with changes.
export default function Privacy({ updated, contact_email }: Props) {
  const email = (
    <a href={`mailto:${contact_email}`} className="font-medium text-wine-800 underline underline-offset-4">
      {contact_email}
    </a>
  )

  return (
    <ShopLayout>
      <Head title="Privacy policy" />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl font-semibold text-wine-800 sm:text-5xl">Privacy policy</h1>
        <p className="mt-2 text-taupe-600">Last updated {updated}</p>

        <Section title="Who we are">
          <p>
            The Comfy Zone by Fazy is a clothing business in Ghana. We sell through live videos on social media, on WhatsApp, and on this
            website, comfyzone.shop. This policy explains what we know about you, why, and what you can ask us to do with it.
          </p>
          <p>Questions or requests: email {email}, or message us on WhatsApp.</p>
        </Section>

        <Section title="What we collect">
          <ul>
            <li>
              <strong>Who you are:</strong> your name, phone number, and, if you buy from a live, your username on that platform. On
              WhatsApp, also the name on your WhatsApp profile.
            </li>
            <li>
              <strong>Your orders:</strong> what you ordered or reserved, prices, payments, and, if you send it, the mobile money
              transaction ID you paid with.
            </li>
            <li>
              <strong>Delivery:</strong> your area and the address or landmark you give for delivery.
            </li>
            <li>
              <strong>Messages:</strong> what you write to our WhatsApp shop and our replies, including replies from our automated
              assistant.
            </li>
            <li>
              <strong>Requests:</strong> items you ask us to tell you about when they are back in stock.
            </li>
            <li>
              <strong>Your account, if you make one:</strong> your name, phone number, email if you give it, your password (stored
              scrambled, so nobody, including us, can read it), the delivery details you save, and the devices you are logged in on. If you
              add Face ID or a fingerprint, your face or fingerprint never leaves your phone: we only keep a code your phone uses to prove
              it's you.
            </li>
          </ul>
          <p>
            On this website, your shopping bag is kept in a small cookie on your device, and if you log in, another cookie keeps you logged
            in for up to a year. We don't use advertising trackers, and we don't sell your information to anyone.
          </p>
        </Section>

        <Section title="Why we use it">
          <ul>
            <li>To take, reserve, deliver and, if needed, return or swap your orders.</li>
            <li>To confirm your payments and tell you what is still to pay.</li>
            <li>To answer your questions on WhatsApp, including through our automated assistant.</li>
            <li>To tell you when something you asked for is back in stock.</li>
            <li>To keep the business records the law expects of us.</li>
          </ul>
        </Section>

        <Section title="WhatsApp and our automated assistant">
          <p>
            Our WhatsApp shop uses the WhatsApp Business Platform from Meta. Messages you send us pass through WhatsApp's systems, and
            Meta's own privacy policy also applies to your use of WhatsApp. An automated assistant answers first: it can show you what's in
            stock and reserve items for you. You can ask for a person at any time ("Talk to Fazy").
          </p>
          <p>A reservation holds the items for a short time. If it isn't paid in that time it is released, and we tell you on WhatsApp.</p>
        </Section>

        <Section title="Who we share it with">
          <p>Only who we must, to serve you:</p>
          <ul>
            <li>
              <strong>Meta (WhatsApp)</strong>, to deliver messages between us.
            </li>
            <li>
              <strong>Delivery riders</strong>: your name, phone number and delivery address, to bring your order.
            </li>
            <li>
              <strong>Payment services</strong>, such as mobile money networks, when you pay us.
            </li>
            <li>
              <strong>The companies that run our server and email</strong>, which store or send information for us and may not use it for
              anything else.
            </li>
            <li>Authorities, if the law requires it.</li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <p>
            Order and payment records are kept as long as we need them to run the business and as the law requires for business and tax
            records. WhatsApp messages are kept to help with your orders. You can ask us to delete your information at any time (see below).
            Some records, such as payments, may have to be kept where the law requires.
          </p>
        </Section>

        <Section title="Your rights, and deleting your data">
          <p>
            Under Ghana's Data Protection Act, 2012 (Act 843), you can ask us to show you the information we hold about you, correct it, or
            delete it, and you can tell us to stop sending you messages.
          </p>
          <p>
            <strong>To delete your data</strong>, email {email} or send us "delete my data" on WhatsApp from the number you used with us (
            <a href="/data-deletion" className="font-medium text-wine-800 underline underline-offset-4">
              step by step
            </a>
            ). We will confirm when it's done, as soon as we can and within one month. If you have an order in progress, we will finish or
            cancel it first.
          </p>
          <p>You can delete your account yourself under My account. Your orders stay with us as sales records, as explained above.</p>
          <p>If you are unhappy with how we handle your information, you can also contact Ghana's Data Protection Commission.</p>
        </Section>

        <Section title="Keeping it safe">
          <p>
            Our website and back office use encrypted connections (https). Only our staff can see customer information, and each staff
            member only sees what their role needs.
          </p>
        </Section>

        <Section title="Children">
          <p>Our shop is for adults. If you are under 18, please ask a parent or guardian to order for you.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If we change this policy, we'll update it here and change the date at the top.</p>
        </Section>
      </article>
    </ShopLayout>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-semibold text-wine-800">{title}</h2>
      <div className="mt-2 space-y-3 leading-relaxed text-taupe-900 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
