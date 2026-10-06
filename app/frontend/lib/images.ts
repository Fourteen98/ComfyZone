// Phone cameras produce photos of 3 to 8 MB. Sending five of those over
// mobile data is slow and costs her data. So before uploading, the browser
// redraws each photo at a sensible size and saves it as a JPEG, typically
// 200 to 500 KB, with no visible loss on a screen.
//
// If anything goes wrong (an unusual format, an old browser) the original
// file is sent untouched, and Rails still checks it on arrival.
export async function shrinkPhoto(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  try {
    // 'from-image' applies the phone's rotation, so portraits stay upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))

    // Already small and already a JPEG: nothing to gain.
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 600_000) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
