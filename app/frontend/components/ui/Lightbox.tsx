import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

type Props = {
  images: { url: string; alt: string }[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

const control =
  'flex size-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white'

// A full-screen view of one image at a time.
// Close with the X, the Escape key, or by clicking the dark area.
// Left and right arrow keys move between images.
export default function Lightbox({ images, index, onIndexChange, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const many = images.length > 1
  const step = (by: number) => onIndexChange((index + by + images.length) % images.length)

  useEffect(() => {
    closeButton.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && many) step(-1)
      if (event.key === 'ArrowRight' && many) step(1)
    }
    window.addEventListener('keydown', onKey)
    // Stop the page behind from scrolling while this is open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // The function returned from useEffect is the clean-up: it runs when
    // the lightbox closes, undoing everything set up above.
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
      onClick={onClose}
    >
      <img
        src={images[index].url}
        alt={images[index].alt}
        className="max-h-full max-w-full rounded-md object-contain"
        // Clicking the photo itself shouldn't close the viewer.
        onClick={(event) => event.stopPropagation()}
      />

      <button ref={closeButton} type="button" aria-label="Close" onClick={onClose} className={`${control} absolute top-4 right-4`}>
        <X className="size-6" aria-hidden="true" />
      </button>

      {many && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(event) => {
              event.stopPropagation()
              step(-1)
            }}
            className={`${control} absolute top-1/2 left-3 -translate-y-1/2`}
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(event) => {
              event.stopPropagation()
              step(1)
            }}
            className={`${control} absolute top-1/2 right-3 -translate-y-1/2`}
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
          <p className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white tabular-nums">
            {index + 1} of {images.length}
          </p>
        </>
      )}
    </div>
  )
}
