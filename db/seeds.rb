# Run with `bin/rails db:seed` (also runs as part of `bin/rails db:setup`).
#
# Seeds are starting data, not sample data. Everything here is written to be
# safe to run again and again: it creates what is missing and never
# overwrites what someone has since changed in the app.

# ---------- Roles ----------
#
# `find_or_create_by!(name:)` looks the role up by name. The block only runs
# when the role is being created, so permissions edited later in
# Settings > Roles are left alone.

Role.find_or_create_by!(name: "Owner") do |role|
  role.system = true
  role.description = "Full access to everything. Cannot be changed or removed."
end

Role.find_or_create_by!(name: "Manager") do |role|
  role.description = "Runs the shop day to day. Everything except people and roles."
  role.permissions = Permission::KEYS - %w[ users.manage roles.manage ]
end

Role.find_or_create_by!(name: "Sales assistant") do |role|
  role.description = "Records sales during lives and looks after customers. Can't see cost prices."
  role.permissions = %w[
    products.view stock.view
    orders.view orders.create orders.fulfil
    customers.view customers.manage
  ]
end

Role.find_or_create_by!(name: "Packer") do |role|
  role.description = "Packs and hands over orders."
  role.permissions = %w[ products.view stock.view orders.view orders.fulfil ]
end

# ---------- Option presets ----------
#
# The ready-made lists she picks from when adding a product. The order
# written here is the order they are shown in. Edit them any time in
# Settings > Options; running seeds again will not undo those edits.

sizes = {
  "Letter sizes"   => %w[ XS S M L XL 2XL 3XL 4XL 5XL ],
  "UK dress sizes" => %w[ 6 8 10 12 14 16 18 20 22 24 26 ],
  "Waist sizes"    => %w[ 28 30 32 34 36 38 40 42 44 ],
  "Shoe sizes"     => %w[ 36 37 38 39 40 41 42 43 44 45 46 ],
  "Free size"      => [ "One size" ]
}

sizes.each do |name, labels|
  OptionPreset.find_or_create_by!(name: name) do |preset|
    preset.option_name = "Size"
    preset.values = labels.map { |label| { label: label } }
  end
end

OptionPreset.find_or_create_by!(name: "Lengths") do |preset|
  preset.option_name = "Length"
  preset.values = [ "Mini", "Knee length", "Midi", "Maxi", "Floor length" ].map { |label| { label: label } }
end

OptionPreset.find_or_create_by!(name: "Colours") do |preset|
  preset.option_name = "Colour"
  preset.values = {
    "Black" => "#1a1a1a", "White" => "#ffffff", "Cream" => "#f3e9d7", "Beige" => "#d8c3a5",
    "Brown" => "#6f4e37", "Grey" => "#8a8a8a", "Navy" => "#1f2a4d", "Blue" => "#2f6fd0",
    "Sky blue" => "#8cc4ee", "Green" => "#2e8b57", "Olive" => "#6b7a3a", "Yellow" => "#f2c81d",
    "Mustard" => "#c9962b", "Orange" => "#e8792b", "Red" => "#c0262d", "Wine" => "#5a1f2b",
    "Pink" => "#f29bb6", "Purple" => "#7a4aa3", "Gold" => "#c9a24a", "Silver" => "#c0c4c9"
  }.map { |label, swatch| { label: label, swatch: swatch } }
end

# ---------- Categories ----------
#
# A starting set for clothing. Rename, reorder, hide or add to them in
# Settings > Categories.

[ "Dresses", "Tops", "Trousers", "Skirts", "Two-piece sets", "Loungewear", "Accessories" ].each do |name|
  Category.find_or_create_by!(name: name)
end

# ---------- A first login, for local development only ----------
if Rails.env.development?
  User.find_or_create_by!(email_address: "owner@comfyzone.test") do |user|
    user.name = "Owner"
    user.password = "password"
    user.role = Role.find_by!(name: "Owner")
  end
  puts "Dev login: owner@comfyzone.test / password"
end

# ---------- Sales channels ----------
# Where sales come from. Editable in Settings > Sales channels.
# (The migration that made the table already adds these, so on an existing
# database every line here finds its row and changes nothing.)
#   social = buyers are known by a username; direct = by name or phone.
{
  "TikTok" => "social", "Instagram" => "social", "Facebook" => "social", "Snapchat" => "social",
  "WhatsApp" => "direct", "Phone call" => "direct", "Walk-in" => "direct"
}.each do |name, kind|
  SalesChannel.find_or_create_by!(name: name) { |channel| channel.kind = kind }
end

# ---------- Delivery areas (development only) ----------
# Examples to try the app with. The real list belongs to the business and is
# typed into Settings > Delivery areas, so production starts empty.
if Rails.env.development?
  { "Osu" => "20", "East Legon" => "25", "Madina" => "30", "Tema" => "45", "Kasoa" => "50" }.each do |name, fee|
    DeliveryArea.find_or_create_by!(name: name) { |area| area.fee = fee }
  end
end
