# Lesson 8: Product photos

What changed: each product can have up to five photos. The product page has
a gallery with a full-screen viewer, and the product list is now a grid of
photo cards. Photos are shrunk on the phone before uploading, so they send
quickly over mobile data.

After pulling this step, run:

```sh
brew install vips      # once: the library Rails uses to resize images
bundle install && npm install && bin/rails db:migrate
bin/dev
```

Without `vips`, uploads still save but the resized copies fail and photos
show as broken images.

## 1. Active Storage: files are not rows

Rails keeps uploaded files *outside* the database and tracks them in it.

```
product_photos          active_storage_attachments      active_storage_blobs        disk
--------------          --------------------------      --------------------        ----
id 7, product 4   <---  record: ProductPhoto 7    --->  filename, size, type  --->  storage/ab/cd/abcd...
position 1              name: "image"                   key: "abcd..."
```

- A **blob** is one stored file: its name, size, type, and where it lives.
- An **attachment** joins a blob to one of your records.
- The file itself sits in `storage/` in development. In production the same
  code can point at cloud storage by changing `config/storage.yml`; nothing
  else changes.

`bin/rails active_storage:install` created the migration for those tables.
You never touch them directly; you write:

```ruby
class ProductPhoto < ApplicationRecord
  has_one_attached :image
end

photo.image.attach(file)
photo.image.attached?   # => true
```

## 2. Why a `product_photos` table of our own

Rails also offers `has_many_attached :photos` directly on a product, with no
extra table. We did not use it because attachments have no order, and we
need one: the first photo is the cover. So each photo is its own small
record with a `position`, holding one attached image.

When a built-in feature lacks something you need, wrapping it in your own
model is usually cleaner than fighting it.

## 3. Variants: resized copies, made on demand

```ruby
has_one_attached :image do |attachable|
  attachable.variant :thumb, resize_to_fill: [ 160, 200 ]
  attachable.variant :card,  resize_to_fill: [ 600, 750 ]
  attachable.variant :large, resize_to_limit: [ 1600, 1600 ]
end
```

(Active Storage calls these "variants" too. They have nothing to do with our
product variants; it is an unlucky clash of names.)

`resize_to_fill` crops to exactly that shape, which is what makes a tidy
grid. `resize_to_limit` only shrinks, never crops or enlarges. All cards use
a 4:5 portrait shape because clothing photos are taller than wide.

The controller sends React an address, not a file:

```ruby
rails_representation_path(photo.image.variant(:card))
```

The resized copy is created the first time a browser asks for that address,
then stored and reused. So the list page never loads full-size photos.

## 4. Never trust an upload

Active Storage has no built-in validations, so `ProductPhoto` has its own:

- **Type**, judged by the file's first bytes (its "magic number"), not its
  name or what the browser claimed. A text file renamed `photo.jpg` is
  refused; there is a test for exactly that.
- **Size**, at most 8 MB.
- **Count**, at most five per product.

The browser's `accept="image/*"` is a convenience for the person choosing a
file. It is not a security check: anyone can send any bytes to the server.
Rule of thumb: the browser helps honest people; the server stops everyone
else.

## 5. Uploading through Inertia

Files cannot travel as JSON, so they go as a multipart form, the same
encoding a plain HTML upload form uses:

```tsx
router.post(`/products/${id}/photos`, { photos: files }, {
  forceFormData: true,
  onProgress: (event) => setProgress(event?.percentage ?? 0),
})
```

On the Rails side they arrive as ordinary params:

```ruby
files = params.expect(photos: [])
```

The upload is all-or-nothing, in a transaction: if the third photo is
rejected, the first two are not left behind.

## 6. Shrinking photos in the browser

`app/frontend/lib/images.ts` redraws each photo onto a canvas at no more
than 1600 pixels on its longest side and saves it as a JPEG. A 5 MB camera
photo becomes a few hundred KB, with no visible difference on a screen.

This matters for her: uploading five photos on mobile data takes seconds
instead of minutes and uses far less data. It also handles the rotation
phones record, so portraits stay upright. If the browser cannot do it, the
original is sent and Rails still checks it.

## 7. Avoiding N+1, again

The list page now needs, for every product, its variants, its photos, each
photo's attachment and each attachment's blob. One line loads them all:

```ruby
products.includes(:variants, photos: { image_attachment: :blob })
```

A hash inside `includes` follows associations of associations. Watch the
log on `/products`: five queries in total, however many products there are.

## 8. On the React side

- `ProductGallery` owns the interaction: which photo is showing, upload
  progress, drag and drop. The photos themselves always come from Rails as
  props, so after any change the page simply shows what the server says.
- `Lightbox` is a reusable full-screen viewer. Its `useEffect` returns a
  clean-up function that removes the keyboard listener and restores page
  scrolling when it closes. Set-up and tear-down living side by side is the
  main thing to learn about `useEffect`.
- A hidden `<input type="file">` is clicked by nicer-looking buttons. On a
  phone, `accept="image/*"` offers both the camera and the gallery.

## Things to know

- **Storage is local for now.** Photos live in the `storage/` folder, which
  is not committed to git. Before going live they should move to cloud
  storage, otherwise a server rebuild would lose them. That belongs to the
  deployment step.
- **Removing a photo is permanent.** The file is deleted too.
- **Photos belong to the product, not to a variant.** Showing a different
  photo per colour is a possible later addition.

## Try it yourself

1. **Add five photos** to a product, make the third the cover, and check the
   product list.
2. **Look at the records** in `bin/rails console`:
   ```ruby
   photo = ProductPhoto.last
   photo.image.blob.attributes.slice("filename", "content_type", "byte_size")
   photo.image.blob.byte_size / 1024   # KB, after the browser shrank it
   ```
3. **Find the file on disk**: `ls -R storage | head -20`.
4. **Fool the browser, not the server**: rename any `.txt` file to `.jpg`
   and try to upload it. Read the message.
5. **Count the queries** on `/products`, then remove
   `photos: { image_attachment: :blob }` from the `includes`, reload, count
   again, and put it back.
