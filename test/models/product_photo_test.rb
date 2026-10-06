require "test_helper"

class ProductPhotoTest < ActiveSupport::TestCase
  def attach(product, file = "photo.jpg", type = "image/jpeg")
    photo = product.photos.build
    photo.image.attach(io: file_fixture(file).open, filename: file, content_type: type)
    photo
  end

  test "photos line up in the order they were added; the first is the cover" do
    dress = products(:dress)
    first = attach(dress).tap(&:save!)
    second = attach(dress).tap(&:save!)

    assert_equal [ 1, 2 ], [ first.position, second.position ]
    assert_equal first, dress.photos.reload.first
  end

  test "a file that isn't really a photo is refused, whatever it claims to be" do
    photo = attach(products(:dress), "not_a_photo.txt", "image/jpeg")

    assert_not photo.save
    assert_includes photo.errors[:image].first, "JPEG, PNG or WebP"
  end

  test "a photo record needs a file" do
    assert_not products(:dress).photos.build.save
  end

  test "the sixth photo is refused" do
    dress = products(:dress)
    Product::MAX_PHOTOS.times { attach(dress).save! }

    sixth = attach(dress)
    assert_not sixth.save
    assert_includes sixth.errors[:base].first, "at most 5"
  end

  test "reordering makes the first id the cover and ignores ids from elsewhere" do
    dress = products(:dress)
    a, b, c = 3.times.map { attach(dress).tap(&:save!) }

    dress.reorder_photos([ c.id, 999_999, a.id ])

    assert_equal [ c, a, b ], dress.photos.reload.to_a
    assert_equal [ 1, 2, 3 ], dress.photos.map(&:position)
  end

  test "deleting a photo deletes its file record too" do
    photo = attach(products(:dress)).tap(&:save!)

    assert_difference "ActiveStorage::Attachment.count", -1 do
      photo.destroy
    end
  end
end
