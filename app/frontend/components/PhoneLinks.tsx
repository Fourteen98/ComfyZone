import { MessageCircle, Phone } from 'lucide-react'
import { formatPhone } from '@/lib/phone'

// A phone number she can act on: tap to call, or open a WhatsApp chat.
// wa.me wants the number as digits with the country code and no +, which
// is exactly what the stored shape (+233...) gives once the + is dropped.
export default function PhoneLinks({ phone }: { phone: string }) {
  const digits = phone.replace(/\D/g, '')
  const link =
    'inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 font-medium text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700'

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <a href={`tel:${phone.startsWith('+') ? `+${digits}` : digits}`} className={`${link} tabular-nums`}>
        <Phone className="size-4" aria-hidden="true" />
        {formatPhone(phone)}
      </a>
      {phone.startsWith('+') && (
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={link}>
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp
        </a>
      )}
    </span>
  )
}
