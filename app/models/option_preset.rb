# A reusable, ordered list of choices for a product option.
#
#   OptionPreset.find_by(name: "Letter sizes").labels  # => ["XS", "S", "M", ...]
#
# Presets are a shortcut for filling in products. A product copies the values
# it uses, so editing or deleting a preset never changes existing products.
class OptionPreset < ApplicationRecord
  include OptionValues # tidying and validating the `values` list

  before_create :place_last

  validates :name, presence: true, uniqueness: { case_sensitive: false }, length: { maximum: 40 }
  validates :option_name, presence: true, length: { maximum: 30 }

  normalizes :name, :option_name, with: ->(text) { text.squish }

  scope :ordered, -> { order(:position, :name) }

  private
    def place_last
      self.position = (OptionPreset.maximum(:position) || 0) + 1 if position.zero?
    end
end
