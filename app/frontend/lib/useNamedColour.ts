import { useEffect, useState } from 'react'
import { lookupHex, paletteHex } from '@/lib/colours'

// The colour for a name being typed ("terracotta" -> its hex), for showing
// it while she types. The grid's colours answer at once; anything else is
// looked up in the big list after a short pause. null when unknown.
//
//   const named = useNamedColour(label)
export function useNamedColour(name: string): string | null {
  const quick = paletteHex(name)
  const [looked, setLooked] = useState<{ name: string; hex: string | null } | null>(null)

  useEffect(() => {
    if (quick || name.trim().length < 3) return
    let current = true
    const timer = setTimeout(() => {
      lookupHex(name).then((hex) => current && setLooked({ name, hex }))
    }, 300)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [name, quick])

  return quick ?? (looked?.name === name ? looked.hex : null)
}
