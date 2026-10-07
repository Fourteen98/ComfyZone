class Customer < ApplicationRecord
  has_many :orders, dependent: :restrict_with_error
  belongs_to :delivery_area, optional: true # the exact place, if known

  # Region + place. The region can be known without the place; when the
  # place is known, the region always follows it.
  before_validation { self.region = delivery_area.region if delivery_area&.region }
  validates :region, inclusion: { in: Region::ALL }, allow_nil: true
  normalizes :region, with: ->(region) { region.presence }

  # Set both from what a form sent. A place typed for the first time is
  # added to the list. Blank region = leave the customer as they are.
  def locate(region:, place:)
    return unless Region.known?(region)

    self.region = region
    self.delivery_area = DeliveryArea.locate(region: region, name: place)
  end

  # "@Ama_K " -> "ama_k". nil if nothing is left.
  normalizes :handle, with: ->(handle) { handle.to_s.strip.delete_prefix("@").gsub(/\s+/, "").downcase.presence }
  normalizes :name, :location, with: ->(text) { text.squish.presence }
  normalizes :phone, with: ->(phone) { phone.squish.presence }

  validates :handle, uniqueness: true, length: { maximum: 40 }, allow_nil: true
  validates :handle, format: { with: /\A[a-z0-9._]+\z/, message: "can only have letters, numbers, dots and underscores" }, allow_nil: true
  validates :name, length: { maximum: 60 }
  validates :phone, format: { with: Supplier::PHONE, message: "doesn't look like a phone number" }, allow_nil: true
  validates :location, length: { maximum: 80 }
  validates :note, length: { maximum: 500 }
  validate :can_be_identified

  scope :ordered, -> { order(Arel.sql("lower(coalesce(name, handle, phone))")) }

  # What to call them on screen: their name if known, otherwise @handle,
  # otherwise their phone number.
  def display_name
    name || (handle && "@#{handle}") || phone
  end

  # The buyer typed during a live: one box, a username. Finds them, or makes
  # a new customer with that username.
  def self.for_claim(typed)
    handle = normalize_value_for(:handle, typed)
    return new if handle.nil?

    find_or_initialize_by(handle: handle)
  end

  # The buyer for a sale recorded by hand, where any of these may be known.
  #
  #   id      she picked someone from the list
  #   handle  a username: the same username is the same person
  #   phone   the same number is the same person, however it is spaced
  #   name    names are NOT unique, so a name alone is always a new customer
  #
  # Anything new she typed fills in blanks on a customer we already had
  # (a known @ama_k gains her phone number), but never overwrites.
  def self.for_sale(id: nil, handle: nil, name: nil, phone: nil)
    return find_by(id: id) || new if id.present?

    handle = normalize_value_for(:handle, handle)
    digits = phone.to_s.gsub(/\D/, "")
    customer = (handle && find_by(handle: handle)) || (digits.present? && with_phone_digits(digits).first) || new

    customer.handle ||= handle
    customer.name ||= name
    customer.phone ||= phone
    customer
  end

  # "024 222 3333" and "0242223333" are the same number.
  scope :with_phone_digits, ->(digits) { where("regexp_replace(phone, '\\D', '', 'g') = ?", digits) }

  private
    def can_be_identified
      return if handle.present? || name.present? || phone.present?

      errors.add(:base, "Give at least a name, a phone number or a username")
    end
end
