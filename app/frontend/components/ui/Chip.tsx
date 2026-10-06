type Props = {
  label: string
  /** A hex colour, e.g. "#c0262d". Shows a coloured dot before the label. */
  swatch?: string | null
}

// A small pill for one choice: a size, a length, a colour.
// Used wherever option values are shown (settings, products, live sales).
export default function Chip({ label, swatch }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-taupe-200 bg-taupe-50 px-2 py-0.5 text-sm">
      {swatch && <Swatch colour={swatch} />}
      {label}
    </span>
  )
}

// The coloured dot on its own. The ring keeps white and cream visible.
export function Swatch({ colour, className = 'size-3.5' }: { colour: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/15 ${className}`}
      style={{ backgroundColor: colour }}
    />
  )
}
