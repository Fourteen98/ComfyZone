# A shopper's account on the website: phone number + password, and passkeys
# they add later. Staff are `User`s, a separate world; nothing here can open
# the back office.
#
#   account = ShopAccount.new(name: "Ama", phone: "024 222 3333", password: "…")
#   account.save        # also links (or makes) the back office's Customer
#   account.orders      # orders placed on the website while logged in
#
# Why "My orders" shows only website orders placed from this account, not
# every order with this phone number: signing up doesn't prove the phone is
# theirs (no SMS code). If it pulled in orders by phone, anyone could type
# someone else's number and read their orders and address. The back office
# still links everything by phone, as it always has.
class ShopAccount < ApplicationRecord
  has_secure_password
  has_many :sessions, class_name: "ShopSession", dependent: :delete_all
  has_many :passkeys, class_name: "ShopPasskey", dependent: :delete_all
  has_many :orders, dependent: :nullify
  belongs_to :customer, optional: true

  # For the "set a new password" link staff send on WhatsApp. It stops
  # working after a day, or as soon as the password changes (the salt is
  # part of the token), so it can be used once.
  generates_token_for :reset_password, expires_in: 1.day do
    password_salt&.last(10)
  end

  normalizes :phone, with: ->(phone) { PhoneNumber.normalize(phone) }
  normalizes :name, with: ->(name) { name.squish }
  normalizes :email, with: ->(email) { email.strip.downcase.presence }

  validates :name, presence: { message: "is needed, so we know who to ask for" }, length: { maximum: 60 }
  validates :phone, presence: { message: "is needed: it's how you log in" }
  validates :phone, uniqueness: { message: "already has an account. Log in instead, or use \"Forgot password?\"" }
  validate :phone_is_a_number
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, message: "doesn't look like an email address" }, allow_nil: true
  validates :password, length: { minimum: 8, message: "must be at least 8 characters" }, allow_nil: true
  validates :delivery_method, inclusion: { in: %w[ pickup delivery ] }, allow_nil: true

  before_validation(on: :create) { self.webauthn_id ||= WebAuthn.generate_user_id }
  before_create :link_customer

  def phone_display = PhoneNumber.format(phone)

  # Checkout, filled in from what they saved.
  def checkout_defaults
    { name: name, phone: phone_display, delivery_method: delivery_method.to_s, address: address.to_s,
      where: { country: country, region: region, place: place } }
  end

  # After an order: keep its details for next time.
  def remember!(delivery_method: nil, address: nil, where: nil)
    where = (where || {}).to_h.symbolize_keys
    update!(delivery_method: delivery_method.presence, address: address.to_s.squish.presence,
            country: where[:country].presence, region: where[:region].presence, place: where[:place].presence)
  end

  private
    def phone_is_a_number
      return if phone.blank? || PhoneNumber.valid?(phone)

      errors.add(:phone, "doesn't look like a phone number. Try 024 123 4567")
    end

    # The back office's record for this phone: the one she already has (from
    # a live, WhatsApp or an earlier order), or a new one. Only blanks are
    # filled, exactly like a guest checkout (Customer.for_sale).
    def link_customer
      found = Customer.for_sale(name: name, phone: phone)
      found.save! if found.new_record? || found.changed?
      self.customer = found
    end
end
