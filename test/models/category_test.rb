require "test_helper"

class CategoryTest < ActiveSupport::TestCase
  test "makes a URL-friendly slug from the name" do
    assert_equal "two-piece-sets", Category.create!(name: "Two-piece sets").slug
  end

  test "slugs stay unique by adding a number" do
    Category.create!(name: "Tops & Tees")

    assert_equal "tops-tees-2", Category.create!(name: "Tops Tees").slug
  end

  test "renaming keeps the slug, so saved links keep working" do
    category = categories(:dresses)

    category.update!(name: "Gowns")

    assert_equal "dresses", category.slug
  end

  test "names are required and unique regardless of capitals" do
    assert_not Category.new(name: " ").valid?
    assert_not Category.new(name: "DRESSES").valid?
  end

  test "new categories go to the end" do
    assert_equal Category.create!(name: "Shoes"), Category.ordered.last
  end

  test "moving swaps with the neighbour and stops at the ends" do
    categories(:bags).move(:up)
    assert_equal [ "Bags", "Dresses", "Old season" ], Category.ordered.map(&:name)

    categories(:bags).reload.move(:up) # already first: nothing happens
    assert_equal "Bags", Category.ordered.first.name

    categories(:bags).reload.move(:down)
    assert_equal [ "Dresses", "Bags", "Old season" ], Category.ordered.map(&:name)
  end

  test "deleting a category keeps its products" do
    dress = products(:dress)

    assert_no_difference "Product.count" do
      categories(:dresses).destroy
    end
    assert_nil dress.reload.category
  end

  test "the database protects products even if Rails is bypassed" do
    # delete_all skips model callbacks entirely; only the foreign key's
    # ON DELETE SET NULL is at work here.
    Category.where(id: categories(:dresses).id).delete_all

    assert_nil products(:dress).reload.category_id
  end
end
