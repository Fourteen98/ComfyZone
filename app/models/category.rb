# What kind of thing a product is. Managed in Settings > Categories.
class Category < ApplicationRecord
  # Deleting a category keeps its products and clears their category.
  # (The foreign key in the database says the same thing; see the migration.)
  has_many :products, dependent: :nullify

  include Positioned # position, move(:up / :down)

  normalizes :name, with: ->(name) { name.squish }

  before_validation :assign_slug, on: :create

  validates :name, presence: true, length: { maximum: 40 }, uniqueness: { case_sensitive: false }
  validates :slug, presence: true, uniqueness: true

  scope :ordered, -> { order(:position, :name) }
  scope :active, -> { where(active: true) }

  private
    # "Two-piece sets" -> "two-piece-sets". If that is taken, add -2, -3 ...
    def assign_slug
      return if slug.present? || name.blank?

      base = name.parameterize.presence || "category"
      candidate = base
      number = 2
      while Category.exists?(slug: candidate)
        candidate = "#{base}-#{number}"
        number += 1
      end
      self.slug = candidate
    end
end
