import { Link } from '@inertiajs/react'
import type { InertiaLinkProps } from '@inertiajs/react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

type Look = {
  variant?: Variant
  /** Stretch to the full width of the container (good for phone forms). */
  block?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-wine-800 text-taupe-50 hover:bg-wine-700 active:bg-wine-900',
  secondary: 'border border-taupe-300 bg-white text-wine-800 hover:bg-taupe-100',
  danger: 'border border-red-300 bg-white text-red-800 hover:bg-red-50',
}

function classes({ variant = 'primary', block = false }: Look, extra = '') {
  return [
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-base font-medium tracking-wide',
    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    block ? 'w-full' : '',
    extra,
  ].join(' ')
}

// The one button used everywhere. Pages choose a variant; they never restyle it.
export default function Button({
  variant,
  block,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Look) {
  return <button {...props} className={classes({ variant, block }, className)} />
}

// Looks like a Button, but navigates to another page.
// Use Button for "do something", ButtonLink for "go somewhere".
export function ButtonLink({ variant, block, className, ...props }: InertiaLinkProps & Look) {
  return <Link {...props} className={classes({ variant, block }, className as string | undefined)} />
}
