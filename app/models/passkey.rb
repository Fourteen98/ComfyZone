# One registered device (or synced keychain) that can log a person in.
#
# What is stored here is safe to leak: it is only the PUBLIC half of a key
# pair. The private half never leaves the person's device, and neither does
# their face or fingerprint.
class Passkey < ApplicationRecord
  belongs_to :user

  normalizes :name, with: ->(name) { name.squish }

  validates :name, presence: true, length: { maximum: 40 }
  validates :external_id, presence: true, uniqueness: true
  validates :public_key, presence: true

  scope :ordered, -> { order(created_at: :asc) }
end
