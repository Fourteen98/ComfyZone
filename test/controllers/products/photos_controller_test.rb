require "test_helper"

class Products::PhotosControllerTest < ActionDispatch::IntegrationTest
  def photo
    fixture_file_upload("photo.jpg", "image/jpeg")
  end

  test "uploads several photos at once" do
    sign_in_as(users(:one))
    dress = products(:dress)

    assert_difference -> { dress.photos.count }, 2 do
      post product_photos_path(dress), params: { photos: [ photo, photo ] }
    end

    assert_redirected_to product_path(dress)
    follow_redirect!
    photos = inertia.props[:product][:photos]
    assert_equal 2, photos.size
    assert_match %r{/rails/active_storage/representations/}, photos.first[:thumb_url]
  end

  test "the resized copies really are made" do
    sign_in_as(users(:one))
    post product_photos_path(products(:dress)), params: { photos: [ photo ] }
    follow_redirect!

    get inertia.props[:product][:photos].first[:thumb_url]
    follow_redirect! while response.redirect?

    assert_response :success
    assert_equal "image/jpeg", response.media_type
  end

  test "refuses more than the product has room for, and adds none of them" do
    sign_in_as(users(:one))
    dress = products(:dress)
    post product_photos_path(dress), params: { photos: [ photo, photo, photo, photo ] }

    assert_no_difference -> { dress.photos.count } do
      post product_photos_path(dress), params: { photos: [ photo, photo ] }
    end

    follow_redirect!
    assert_includes inertia.props[:errors][:photos].first, "1 more photo"
  end

  test "one bad file means none of the batch is kept" do
    sign_in_as(users(:one))
    dress = products(:dress)

    assert_no_difference -> { dress.photos.count } do
      post product_photos_path(dress),
        params: { photos: [ photo, fixture_file_upload("not_a_photo.txt", "image/jpeg") ] }
    end

    follow_redirect!
    assert_includes inertia.props[:errors][:photos].first, "not_a_photo.txt"
  end

  test "removes a photo and closes the gap" do
    sign_in_as(users(:one))
    dress = products(:dress)
    post product_photos_path(dress), params: { photos: [ photo, photo, photo ] }
    first, second, third = dress.photos.reload.to_a

    delete product_photo_path(dress, second)

    assert_equal [ first, third ], dress.photos.reload.to_a
    assert_equal [ 1, 2 ], dress.photos.map(&:position)
  end

  test "changes the cover photo" do
    sign_in_as(users(:one))
    dress = products(:dress)
    post product_photos_path(dress), params: { photos: [ photo, photo ] }
    first, second = dress.photos.reload.to_a

    patch order_product_photos_path(dress), params: { ids: [ second.id, first.id ] }

    assert_equal second, dress.photos.reload.first
  end

  test "the product list shows each product's cover" do
    sign_in_as(users(:one))
    post product_photos_path(products(:dress)), params: { photos: [ photo ] }

    get products_path

    assert_match %r{/rails/active_storage/representations/}, inertia.props[:products].first[:cover_url]
  end

  test "can't remove a photo through the wrong product" do
    sign_in_as(users(:one))
    post product_photos_path(products(:dress)), params: { photos: [ photo ] }

    delete product_photo_path(products(:old_bag), products(:dress).photos.first)

    assert_response :not_found
  end

  test "needs products.manage" do
    sign_in_as(users(:two))

    assert_no_difference "ProductPhoto.count" do
      post product_photos_path(products(:dress)), params: { photos: [ photo ] }
    end
    assert_redirected_to admin_root_path
  end
end
