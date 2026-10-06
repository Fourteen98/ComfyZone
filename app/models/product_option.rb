# One option of one product: "Size" with the values this product comes in.
class ProductOption < ApplicationRecord
  include OptionValues

  belongs_to :product

  normalizes :name, with: ->(name) { name.squish }

  validates :name, presence: true, length: { maximum: 30 }
end
