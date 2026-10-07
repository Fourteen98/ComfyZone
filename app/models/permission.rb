# The complete list of things a person can be allowed to do.
#
# This is a plain Ruby module, not a database table. Permissions are part of
# the code: each key is checked somewhere in a controller, so a new one only
# makes sense when code is written to enforce it. Roles (which ARE in the
# database, and editable in Settings) pick from this list.
#
# To add a permission: add a line here, then guard the feature with
#   require_permission "the.key"
#
# Keys are "<area>.<action>". Labels are what the Roles screen shows.
module Permission
  GROUPS = {
    "Products" => {
      "products.view"   => "See products",
      "products.manage" => "Add, edit and archive products"
    },
    "Purchases" => {
      "purchases.view"   => "See purchases and suppliers",
      "purchases.manage" => "Record purchases and manage suppliers"
    },
    "Stock" => {
      "stock.view"   => "See stock levels",
      "stock.adjust" => "Adjust stock by hand"
    },
    "Sales" => {
      "orders.view"   => "See orders",
      "orders.create" => "Record sales",
      "orders.fulfil" => "Mark orders paid, packed and delivered",
      "orders.refund" => "Cancel and refund orders"
    },
    "Customers" => {
      "customers.view"   => "See customers",
      "customers.manage" => "Add and edit customers"
    },
    "Money" => {
      "costs.view"   => "See cost prices and profit",
      "reports.view" => "See reports",
      "expenses.view"   => "See expenses",
      "expenses.manage" => "Record and change expenses"
    },
    "Settings" => {
      "settings.manage" => "Change business settings",
      "users.manage"    => "Add people and change their access",
      "roles.manage"    => "Create and edit roles"
    }
  }.freeze

  # Every key, in display order: ["products.view", "products.manage", ...]
  KEYS = GROUPS.values.flat_map(&:keys).freeze

  def self.exists?(key)
    KEYS.include?(key.to_s)
  end

  # Raises on a typo, so a misspelt key fails loudly at boot, not silently
  # in production.
  def self.fetch!(key)
    exists?(key) ? key.to_s : raise(ArgumentError, "Unknown permission: #{key.inspect}")
  end

  # Shaped for the Roles form in React.
  def self.as_groups
    GROUPS.map do |name, permissions|
      { name: name, permissions: permissions.map { |key, label| { key: key, label: label } } }
    end
  end
end
