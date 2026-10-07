import { router, usePage } from '@inertiajs/react'
import { Camera, ImagePlus, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Lightbox from '@/components/ui/Lightbox'
import { shrinkPhoto } from '@/lib/images'
import { confirmAction } from '@/lib/confirm'

export type Photo = { id: number; thumb_url: string; large_url: string }

type Props = {
  productId: number
  productName: string
  photos: Photo[]
  maxPhotos: number
  /** Show the controls for adding, removing and choosing the cover. */
  manage: boolean
}

// A product's photos: one large view, a strip of five slots beneath it.
// The first photo is the cover (what the product list shows).
export default function ProductGallery({ productId, productName, photos, maxPhotos, manage }: Props) {
  const errors = usePage().props.errors as Record<string, string[] | undefined>
  const picker = useRef<HTMLInputElement>(null)

  const [chosen, setChosen] = useState(0)
  const [viewing, setViewing] = useState(false)
  const [progress, setProgress] = useState<number | null>(null) // null = not uploading
  const [dragging, setDragging] = useState(false)
  const [leftOut, setLeftOut] = useState(0) // photos she chose that didn't fit

  // If the photo being shown was just removed, fall back to the last one.
  const index = Math.min(chosen, Math.max(photos.length - 1, 0))
  const current = photos[index]
  const room = maxPhotos - photos.length
  const uploading = progress !== null

  async function upload(list: FileList | File[]) {
    if (uploading) return
    const images = Array.from(list).filter((file) => file.type.startsWith('image/'))
    const files = images.slice(0, room)
    // Tell her if she picked more than there is room for; never drop
    // something silently.
    setLeftOut(images.length - files.length)
    if (files.length === 0) return

    setProgress(0)
    // Shrink on the phone first (see lib/images.ts), then send.
    const small = await Promise.all(files.map((file) => shrinkPhoto(file)))

    // Files can't travel as JSON, so Inertia sends this as a multipart form,
    // the same encoding as an HTML <form enctype="multipart/form-data">.
    router.post(
      `/admin/products/${productId}/photos`, // -> Products::PhotosController#create
      { photos: small },
      {
        forceFormData: true,
        preserveScroll: true,
        onProgress: (event) => setProgress(event?.percentage ?? 0),
        onFinish: () => {
          setProgress(null)
          if (picker.current) picker.current.value = '' // allow picking the same file again
        },
      },
    )
  }

  function makeCover(photo: Photo) {
    const ids = [photo.id, ...photos.filter((p) => p.id !== photo.id).map((p) => p.id)]
    router.patch(`/admin/products/${productId}/photos/order`, { ids }, { preserveScroll: true, onSuccess: () => setChosen(0) })
  }

  async function remove(photo: Photo) {
    if (!(await confirmAction('Remove this photo?', { confirm: 'Remove', danger: true }))) return
    router.delete(`/admin/products/${productId}/photos/${photo.id}`, { preserveScroll: true })
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (manage && room > 0) void upload(event.dataTransfer.files)
  }

  const openPicker = () => picker.current?.click()

  return (
    <div
      onDragOver={(event) => {
        if (!manage || room === 0) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* ---------- The large view ---------- */}
      <div
        className={`relative aspect-[4/5] overflow-hidden rounded-lg bg-taupe-200 ${
          dragging ? 'outline-3 outline-offset-2 outline-wine-700' : ''
        }`}
      >
        {current ? (
          <button
            type="button"
            onClick={() => setViewing(true)}
            aria-label="View photo full screen"
            className="block size-full cursor-zoom-in focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-wine-700"
          >
            {/* key={current.id} makes React swap the element, so the old
                photo never lingers while the new one loads. */}
            <img key={current.id} src={current.large_url} alt={`${productName}, photo ${index + 1}`} className="size-full object-cover" />
          </button>
        ) : manage ? (
          <button
            type="button"
            onClick={openPicker}
            className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center text-taupe-700 hover:bg-taupe-300/60 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-wine-700"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-taupe-50 text-wine-800">
              <Camera className="size-8" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl font-semibold text-wine-800">Add photos</span>
            <span className="max-w-56 text-sm">Take them now or choose from your gallery. Up to {maxPhotos}.</span>
          </button>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-taupe-600">
            <Camera className="size-10" aria-hidden="true" />
            <span className="text-sm">No photos yet</span>
          </div>
        )}

        {index === 0 && current && photos.length > 1 && (
          <span className="absolute top-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-medium text-white">Cover</span>
        )}

        {uploading && (
          <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-4 py-3 text-sm text-white" role="status">
            <p>Uploading… {progress}%</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full bg-white transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ---------- Actions for the photo on show ---------- */}
      {manage && current && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {index === 0 ? (
            <p className="flex items-center gap-1.5 px-1 text-sm text-taupe-700">
              <Star className="size-4 fill-current text-wine-700" aria-hidden="true" />
              This is the cover, shown in your product list.
            </p>
          ) : (
            <Button type="button" variant="secondary" className="min-h-10! px-3!" onClick={() => makeCover(current)}>
              <Star className="size-4" aria-hidden="true" />
              Make this the cover
            </Button>
          )}
          <Button type="button" variant="danger" className="min-h-10! px-3!" onClick={() => remove(current)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Remove
          </Button>
        </div>
      )}

      {leftOut > 0 && (
        <p className="mt-3 border-l-2 border-amber-600 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900" role="status">
          {leftOut === 1 ? '1 photo was' : `${leftOut} photos were`} left out. A product holds {maxPhotos}; remove one
          to make room.
        </p>
      )}

      {errors.photos && (
        <div className="mt-3">
          <Alert tone="error">{errors.photos[0]}</Alert>
        </div>
      )}

      {/* ---------- The strip: five slots ----------
          People who can't manage photos just see the thumbnails. */}
      {(manage || photos.length > 1) && (
        <ul className="mt-3 grid grid-cols-5 gap-2">
          {photos.map((photo, i) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setChosen(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`block aspect-[4/5] w-full overflow-hidden rounded-md bg-taupe-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 ${
                  i === index ? 'ring-2 ring-wine-800 ring-offset-2 ring-offset-taupe-50' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <img src={photo.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}

          {manage &&
            Array.from({ length: room }, (_, i) => (
              <li key={`empty-${i}`}>
                {i === 0 ? (
                  // The next free slot is the "add" button.
                  <button
                    type="button"
                    onClick={openPicker}
                    disabled={uploading}
                    aria-label="Add photos"
                    className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-wine-700/50 text-wine-800 hover:border-wine-800 hover:bg-wine-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700 disabled:opacity-50"
                  >
                    <ImagePlus className="size-6" aria-hidden="true" />
                    <span className="text-xs font-medium">Add</span>
                  </button>
                ) : (
                  <div className="aspect-[4/5] rounded-md border-2 border-dashed border-taupe-300" aria-hidden="true" />
                )}
              </li>
            ))}
        </ul>
      )}

      {manage && (
        <p className="mt-2 px-1 text-sm text-taupe-700 tabular-nums">
          {photos.length} of {maxPhotos} photos.
          {room > 0 && photos.length > 0 && ' Tap a photo to see it large.'}
        </p>
      )}

      {/* The real file input is hidden; the buttons above click it.
          accept="image/*" lets a phone offer both the camera and the gallery. */}
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => event.target.files && void upload(event.target.files)}
      />

      {viewing && current && (
        <Lightbox
          images={photos.map((photo, i) => ({ url: photo.large_url, alt: `${productName}, photo ${i + 1}` }))}
          index={index}
          onIndexChange={setChosen}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  )
}
