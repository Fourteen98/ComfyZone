// A link that opens WhatsApp with a chat to this number and the message
// already typed. She checks it and taps send; nothing goes automatically.
// wa.me wants the number as digits with the country code and no "+".
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}
