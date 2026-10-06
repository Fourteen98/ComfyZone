# Uploading, removing and reordering a product's photos.
class Products::PhotosController < InertiaController
  require_permission "products.manage"
  before_action :set_product

  # POST /products/:product_id/photos   (multipart form with photos[])
  def create
    files = params.expect(photos: [])
    room = Product::MAX_PHOTOS - @product.photos.count

    if files.size > room
      return fail_with(room.zero? ? "This product already has #{Product::MAX_PHOTOS} photos. Remove one first." :
        "You can add #{room} more #{'photo'.pluralize(room)}, but you chose #{files.size}.")
    end

    problem = nil
    # All or nothing: if the third photo is rejected, the first two are
    # not left half-added.
    ProductPhoto.transaction do
      files.each do |file|
        photo = @product.photos.build
        photo.image.attach(file)
        next if photo.save

        problem = "#{file.original_filename}: #{photo.errors.full_messages.to_sentence}"
        raise ActiveRecord::Rollback
      end
    end

    return fail_with(problem) if problem

    redirect_to product_path(@product), notice: "Added #{files.size} #{'photo'.pluralize(files.size)}."
  end

  # DELETE /products/:product_id/photos/:id
  def destroy
    @product.photos.find(params.expect(:id)).destroy!
    @product.reorder_photos(@product.photos.reload.map(&:id)) # close the gap in positions

    redirect_to product_path(@product), notice: "Photo removed.", status: :see_other
  end

  # PATCH /products/:product_id/photos/order   with ids: [3, 1, 2]
  def order
    @product.reorder_photos(params.expect(ids: []))

    redirect_to product_path(@product), notice: "Cover photo changed."
  end

  private
    def set_product
      @product = Product.find(params.expect(:product_id))
    end

    def fail_with(message)
      redirect_to product_path(@product), inertia: { errors: { photos: [ message ] } }
    end
end
