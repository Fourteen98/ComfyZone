# One customer's chat on WhatsApp: who they are, and where the bot is with
# them. `context` holds the bot's memory for this chat:
#   { "product_id" => 12, "picks" => { "Colour" => "Black" }, "values" => [...],
#     "variant_id" => 40, "bag" => [{ "variant_id" => 40, "quantity" => 2 }],
#     "order_id" => 77, "page" => 1 }
class WhatsappConversation < ApplicationRecord
  WINDOW = 24.hours # WhatsApp lets us write freely this long after they last wrote

  belongs_to :customer, optional: true
  has_many :messages, -> { order(:id) }, class_name: "WhatsappMessage", dependent: :delete_all
  has_many :orders, dependent: :nullify

  normalizes :phone, with: ->(phone) { PhoneNumber.normalize(phone) }
  validates :phone, presence: true, uniqueness: true

  scope :recent_first, -> { order(last_message_at: :desc, id: :desc) }
  scope :real, -> { where(sandbox: false) }

  # The chat for a number, found or started. `name` is their WhatsApp name.
  def self.for(phone, name: nil, sandbox: false)
    conversation = find_or_create_by!(phone: PhoneNumber.normalize(phone)) { |chat| chat.sandbox = sandbox }
    conversation.update!(profile_name: name) if name.present? && conversation.profile_name != name
    conversation
  end

  def handed_off? = handed_off_at.present?

  # May we send them an ordinary message (not a template) right now?
  def window_open?
    last_inbound_at.present? && last_inbound_at > WINDOW.ago
  end

  def display_name
    customer&.display_name || profile_name || PhoneNumber.format(phone)
  end

  def bag = Array(context["bag"])

  def remember(**changes)
    update!(context: context.merge(changes.transform_keys(&:to_s)))
  end

  def forget(*keys)
    update!(context: context.except(*keys.map(&:to_s)))
  end

  # Their customer record: found by phone (the identity), or made the first
  # time they reserve. Their WhatsApp name is used as the name.
  def customer!
    return customer if customer

    found = Customer.for_sale(phone: phone, name: profile_name)
    found.save! if found.new_record? || found.changed?
    update!(customer: found)
    found
  end
end
