class Customer < ApplicationRecord
  has_many :orders, dependent: :restrict_with_error
  # The waiting list: things they asked for that were sold out.
  has_many :stock_requests, dependent: :destroy
  include Located # country, region, exact place; locate(...), where_text

  # "@Ama_K " -> "ama_k". nil if nothing is left.
  normalizes :handle, with: ->(handle) { handle.to_s.strip.delete_prefix("@").gsub(/\s+/, "").downcase.presence }
  normalizes :name, :location, with: ->(text) { text.squish.presence }
  # Always stored as +233242223333, however it was typed (see PhoneNumber).
  normalizes :phone, with: ->(phone) { PhoneNumber.normalize(phone) }

  validates :handle, uniqueness: true, length: { maximum: 40 }, allow_nil: true
  validates :handle, format: { with: /\A[a-z0-9._]+\z/, message: "can only have letters, numbers, dots and underscores" }, allow_nil: true
  validates :name, length: { maximum: 60 }
  validate :phone_is_a_number
  # The phone number IS the customer: one number, one customer. The unique
  # index in the database is the real guarantee; this gives the message.
  validates :phone, uniqueness: { message: ->(customer, _) { "already belongs to #{Customer.find_by(phone: customer.phone)&.display_name || 'another customer'}" } },
    allow_nil: true
  validates :location, length: { maximum: 80 }
  validates :note, length: { maximum: 500 }
  validate :can_be_identified

  scope :ordered, -> { order(Arel.sql("lower(coalesce(name, handle, phone))")) }

  # Fold a duplicate into this customer: their orders move here, anything
  # we didn't know (a phone number, a username, where they are) is taken
  # from them, and then they are removed. What this customer already has is
  # never overwritten.
  def absorb!(other)
    raise ArgumentError, "A customer can't be merged with themselves" if other == self

    transaction do
      other.orders.update_all(customer_id: id)
      gained = other.slice(:handle, :name, :phone, :location, :country, :region, :delivery_area_id, :note).compact
      # Delete first: two customers can't hold the same username at once.
      other.reload.destroy!
      gained.each { |attribute, value| self[attribute] = value if self[attribute].blank? }
      save!
    end
  end

  # What to call them on screen: their name if known, otherwise @handle,
  # otherwise their phone number.
  def display_name
    name || (handle && "@#{handle}") || phone_display
  end

  # "+233 24 222 3333", for reading.
  def phone_display
    phone && PhoneNumber.format(phone)
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
  #   phone   THE identity: the same number is the same person, however it
  #           was typed. Checked first, so it wins over a username.
  #   handle  a username: the same username is the same person
  #   name    names are NOT unique, so a name alone is always a new customer
  #
  # Anything new she typed fills in blanks on a customer we already had
  # (a known @ama_k gains her phone number), but never overwrites.
  def self.for_sale(id: nil, handle: nil, name: nil, phone: nil)
    return find_by(id: id) || new if id.present?

    handle = normalize_value_for(:handle, handle)
    number = normalize_value_for(:phone, phone)
    customer = (number && find_by(phone: number)) || (handle && find_by(handle: handle)) || new

    customer.handle ||= handle
    customer.name ||= name
    customer.phone ||= phone
    customer
  end

  # For the search box: "024 22" finds +23324 22... (see PhoneNumber.search_digits).
  scope :phone_like, ->(text) { where("phone LIKE ?", "%#{sanitize_sql_like(PhoneNumber.search_digits(text))}%") }

  private
    def phone_is_a_number
      errors.add(:phone, "doesn't look like a phone number. Try 024 123 4567, or +44 7700 900123 abroad") if phone && !PhoneNumber.valid?(phone)
    end

    def can_be_identified
      return if handle.present? || name.present? || phone.present?

      errors.add(:base, "Give at least a name, a phone number or a username")
    end
end
