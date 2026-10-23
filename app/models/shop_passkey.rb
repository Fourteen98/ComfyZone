# A shopper's Face ID / fingerprint login. Only the PUBLIC half of the key
# is stored; the private half never leaves their phone. Kept apart from
# staff passkeys (Passkey), so a shopper's passkey can never open the back office.
class ShopPasskey < ApplicationRecord
  belongs_to :shop_account

  normalizes :name, with: ->(name) { name.squish }

  validates :name, presence: true, length: { maximum: 40 }
  validates :external_id, presence: true, uniqueness: true
  validates :public_key, presence: true

  scope :ordered, -> { order(created_at: :asc) }
end
