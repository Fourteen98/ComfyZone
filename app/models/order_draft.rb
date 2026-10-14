# A sale saved halfway, to finish later. See the create_order_drafts migration.
class OrderDraft < ApplicationRecord
  MAX_BYTES = 20_000 # a big sale is a few kilobytes; this stops junk

  belongs_to :user

  normalizes :label, with: ->(text) { text.to_s.squish.first(120) }

  validates :label, presence: true
  validate :payload_is_a_sale

  scope :newest_first, -> { order(updated_at: :desc) }

  private
    def payload_is_a_sale
      if !payload.is_a?(Hash)
        errors.add(:payload, "isn't a sale")
      elsif payload.to_json.bytesize > MAX_BYTES
        errors.add(:payload, "is too big to save")
      end
    end
end
