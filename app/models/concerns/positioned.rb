# For short lists the owner arranges by hand (categories, sales channels).
# Needs a `position` integer column and an `ordered` scope on the model.
#
#   class Category < ApplicationRecord
#     include Positioned
#   end
#
#   category.move(:up)      # swap places with the one above
#
# This code lived in Category. When a second model needed exactly the same
# thing, it moved here: that is what a concern is for.
module Positioned
  extend ActiveSupport::Concern

  included do
    before_create :place_last
  end

  # Swap places with the neighbour above (:up) or below (:down).
  def move(direction)
    siblings = self.class.ordered.to_a
    index = siblings.index(self)
    target = direction.to_sym == :up ? index - 1 : index + 1
    return if target.negative? || target >= siblings.size

    siblings[index], siblings[target] = siblings[target], siblings[index]
    transaction do
      siblings.each_with_index { |record, i| record.update_column(:position, i + 1) }
    end
  end

  private
    def place_last
      self.position = (self.class.maximum(:position) || 0) + 1 if position.zero?
    end
end
