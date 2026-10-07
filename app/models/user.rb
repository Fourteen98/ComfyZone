class User < ApplicationRecord
  has_secure_password
  has_many :push_subscriptions, dependent: :destroy
  has_many :sessions, dependent: :destroy
  has_many :passkeys, dependent: :destroy
  belongs_to :role

  normalizes :email_address, with: ->(e) { e.strip.downcase }
  normalizes :name, with: ->(n) { n.squish }

  # The random id devices know this person by (see the passkeys migration).
  before_validation(on: :create) { self.webauthn_id ||= WebAuthn.generate_user_id }

  validates :name, presence: true, length: { maximum: 60 }
  validates :email_address, presence: true, uniqueness: { case_sensitive: false },
    format: { with: URI::MailTo::EMAIL_REGEXP, message: "doesn't look like an email address" }
  # allow_nil: when editing someone without touching their password, password
  # is nil and this is skipped. has_secure_password already requires one on create.
  validates :password, length: { minimum: 8 }, allow_nil: true
  validate :business_keeps_an_owner, on: :update

  scope :active, -> { where(active: true) }
  scope :owners, -> { joins(:role).where(roles: { system: true }) }

  # user.can?("products.manage") -> asks the user's role.
  delegate :can?, :effective_permissions, to: :role

  def owner?
    role.system?
  end

  private
    # Never let the last working Owner be demoted or switched off, or nobody
    # could get back into Settings.
    def business_keeps_an_owner
      was_active_owner = active_was && Role.find_by(id: role_id_was)&.system?
      still_active_owner = active? && role&.system?
      return if !was_active_owner || still_active_owner
      return if User.active.owners.where.not(id: id).exists?

      if will_save_change_to_role_id?
        errors.add(:role_id, "can't change: this is the only Owner. Make someone else an Owner first.")
      else
        errors.add(:active, "can't be switched off: this is the only Owner.")
      end
    end
end
