// Phone numbers on the React side. The Rails twin is app/models/phone_number.rb;
// the two follow the same rules, but Rails has the final say on save.
//
// Stored and sent shape: "+233242223333" (E.164: plus, country code, number,
// no leading 0, no spaces). Shown to people: "+233 24 222 3333".

export type Country = { code: string; name: string; flag: string; /** digits after the code, when fixed */ length?: number; example: string }

// Ghana first (the default), then the neighbours and the places goods and
// customers most often come from. Anything else: type the number with its
// + code and it is kept as it is.
export const COUNTRIES: Country[] = [
  { code: '233', name: 'Ghana', flag: '🇬🇭', length: 9, example: '024 123 4567' },
  { code: '234', name: 'Nigeria', flag: '🇳🇬', length: 10, example: '0803 123 4567' },
  { code: '228', name: 'Togo', flag: '🇹🇬', length: 8, example: '90 12 34 56' },
  { code: '225', name: "Côte d'Ivoire", flag: '🇨🇮', length: 10, example: '07 01 23 45 67' },
  { code: '226', name: 'Burkina Faso', flag: '🇧🇫', length: 8, example: '70 12 34 56' },
  { code: '229', name: 'Benin', flag: '🇧🇯', example: '90 01 12 34' },
  { code: '44', name: 'United Kingdom', flag: '🇬🇧', length: 10, example: '07700 900123' },
  { code: '1', name: 'USA / Canada', flag: '🇺🇸', length: 10, example: '201 555 0123' },
  { code: '86', name: 'China', flag: '🇨🇳', length: 11, example: '138 0013 8000' },
  { code: '971', name: 'UAE', flag: '🇦🇪', length: 9, example: '050 123 4567' },
  { code: '90', name: 'Turkey', flag: '🇹🇷', length: 10, example: '0532 123 45 67' },
  { code: '49', name: 'Germany', flag: '🇩🇪', example: '01512 3456789' },
  { code: '27', name: 'South Africa', flag: '🇿🇦', length: 9, example: '071 123 4567' },
]

export const HOME = COUNTRIES[0]

// Longest code first, so "+2348..." is Nigeria (234), not a guess at "23".
const byLongestCode = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)

/**
 * Whatever was typed or pasted -> which country, and the number after the code.
 *   "024 222 3333"       -> Ghana, "242223333"
 *   "+233 24 222 3333"   -> Ghana, "242223333"
 *   "+44 7700 900123"    -> UK,    "7700900123"
 *   "0242223333" with Nigeria chosen -> Nigeria, "242223333" (the 0 is the local prefix)
 */
export function splitPhone(text: string, current: Country = HOME): { country: Country; local: string } {
  const trimmed = text.trim()
  let digits = trimmed.replace(/\D/g, '')

  const international = trimmed.startsWith('+') || digits.startsWith('00')
  if (international) {
    digits = digits.replace(/^00/, '')
    const country = byLongestCode.find((entry) => digits.startsWith(entry.code))
    if (country) return { country, local: digits.slice(country.code.length).replace(/^0/, '') }
    // A code we don't list: keep it all, it is sent as typed.
    return { country: { code: '', name: 'Other', flag: '🌍', example: '+code number' }, local: digits }
  }

  // "233242223333": the code typed without the +.
  if (current.length && digits.startsWith(current.code) && digits.length === current.code.length + current.length) {
    return { country: current, local: digits.slice(current.code.length) }
  }
  return { country: current, local: digits.replace(/^0/, '') }
}

/** Country + local digits -> "+233242223333", or "" when nothing is typed. */
export function joinPhone(country: Country, local: string): string {
  const digits = local.replace(/\D/g, '')
  if (!digits) return ''
  return `+${country.code}${digits}`
}

/** Does it have the right number of digits? Unknown lengths count as fine from 6 digits. */
export function phoneComplete(country: Country, local: string): boolean {
  const digits = local.replace(/\D/g, '')
  return country.length ? digits.length === country.length : digits.length >= 6
}

/** "+233242223333" -> "+233 24 222 3333". Anything else comes back as it was. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const ghana = phone.match(/^\+233(\d{2})(\d{3})(\d{4})$/)
  if (ghana) return `+233 ${ghana[1]} ${ghana[2]} ${ghana[3]}`
  if (!phone.startsWith('+')) return phone
  const { country, local } = splitPhone(phone)
  // Elsewhere: the code, then the number as "rest 123 456" (7700 900 123).
  return country.code && local.length >= 7 ? `+${country.code} ${local.slice(0, -6)} ${local.slice(-6, -3)} ${local.slice(-3)}` : phone
}

/** For search boxes: "024 22" must find "+23324 22...". */
export function phoneSearchDigits(text: string): string {
  return text.replace(/\D/g, '').replace(/^0+/, '')
}
