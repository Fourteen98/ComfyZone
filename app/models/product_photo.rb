# One photo of a product. Up to Product::MAX_PHOTOS each; position 1 is the cover.
class ProductPhoto < ApplicationRecord
  ALLOWED_TYPES = %w[ image/jpeg image/png image/webp ].freeze
  MAX_SIZE = 8.megabytes

  belongs_to :product

  # Active Storage: attaches one uploaded file to each record.
  # The named variants are resized copies, made once on first use and kept.
  # (Needs the libvips library: `brew install vips` on a Mac.)
  has_one_attached :image do |attachable|
    attachable.variant :thumb, resize_to_fill: [ 160, 200 ]   # the strip under the gallery
    attachable.variant :card,  resize_to_fill: [ 600, 750 ]   # product list; 4:5 suits clothing
    attachable.variant :large, resize_to_limit: [ 1600, 1600 ] # full view, never enlarged
  end

  validate :image_is_acceptable
  validate :product_has_room, on: :create

  before_create :place_last

  scope :ordered, -> { order(:position, :id) }

  private
    # Active Storage has no built-in validations, so we write them. Never
    # trust the browser's `accept="image/*"`: that is a hint, not a check.
    def image_is_acceptable
      unless image.attached?
        errors.add(:image, "is missing")
        return
      end

      unless sniffed_type.in?(ALLOWED_TYPES)
        errors.add(:image, "must be a JPEG, PNG or WebP photo")
      end

      if image.blob.byte_size > MAX_SIZE
        errors.add(:image, "is too big. The limit is #{MAX_SIZE / 1.megabyte} MB")
      end
    end

    # What the file really is, judged by its first bytes ("magic numbers"),
    # not by its name or by what the browser claimed. Renaming virus.exe to
    # photo.jpg does not get past this.
    def sniffed_type
      upload = attachment_changes["image"]&.attachable
      io = upload.is_a?(Hash) ? upload[:io] : upload
      return image.blob.content_type unless io.respond_to?(:read) # already stored earlier

      io.rewind
      Marcel::Magic.by_magic(io)&.type
    ensure
      io.rewind if io.respond_to?(:rewind)
    end

    def product_has_room
      return unless product && product.photos.count >= Product::MAX_PHOTOS

      errors.add(:base, "A product can have at most #{Product::MAX_PHOTOS} photos")
    end

    def place_last
      self.position = (product.photos.maximum(:position) || 0) + 1
    end
end
