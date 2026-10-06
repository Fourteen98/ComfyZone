class Role < ApplicationRecord
  # A role that still has people in it cannot be deleted. Instead of raising,
  # `destroy` returns false and puts a message in `errors`.
  has_many :users, dependent: :restrict_with_error

  before_validation :tidy_permissions
  before_destroy :protect_system_role

  validates :name, presence: true, uniqueness: { case_sensitive: false }, length: { maximum: 40 }
  validates :description, length: { maximum: 200 }
  validate :permissions_must_exist

  scope :ordered, -> { order(system: :desc, name: :asc) }

  # The one question the rest of the app asks.
  # The system role (Owner) can do everything, including permissions that
  # are added to the code later, so it never needs updating.
  def can?(key)
    system? || permissions.include?(key.to_s)
  end

  # What this role can actually do, as a list of keys.
  def effective_permissions
    system? ? Permission::KEYS : permissions
  end

  def editable?
    !system?
  end

  private
    # Drop blanks and duplicates, and store keys in the same order as
    # Permission::KEYS. Unknown keys are kept at the end so the validation
    # below can report them.
    def tidy_permissions
      given = Array(permissions).map(&:to_s).compact_blank.uniq
      self.permissions = (Permission::KEYS & given) + (given - Permission::KEYS)
    end

    def permissions_must_exist
      unknown = permissions - Permission::KEYS
      errors.add(:permissions, "include unknown keys: #{unknown.join(', ')}") if unknown.any?
    end

    def protect_system_role
      return unless system?

      errors.add(:base, "The #{name} role is built in and can't be deleted.")
      throw :abort
    end
end
