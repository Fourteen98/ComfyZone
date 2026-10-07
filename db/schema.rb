# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_07_100001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "categories", force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.integer "position", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((name)::text)", name: "index_categories_on_lower_name", unique: true
    t.index ["slug"], name: "index_categories_on_slug", unique: true
  end

  create_table "customers", force: :cascade do |t|
    t.string "handle"
    t.string "name"
    t.string "phone"
    t.string "location"
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "delivery_area_id"
    t.string "region"
    t.string "country"
    t.index ["country"], name: "index_customers_on_country"
    t.index ["delivery_area_id"], name: "index_customers_on_delivery_area_id"
    t.index ["handle"], name: "index_customers_on_handle", unique: true, where: "(handle IS NOT NULL)"
    t.index ["phone"], name: "index_customers_on_phone"
    t.index ["region"], name: "index_customers_on_region"
  end

  create_table "delivery_areas", force: :cascade do |t|
    t.string "name", null: false
    t.integer "fee_pesewas", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "region"
    t.string "country"
    t.index "country, COALESCE(region, ''::character varying), lower((name)::text)", name: "index_delivery_areas_on_country_region_and_lower_name", unique: true
    t.index ["region"], name: "index_delivery_areas_on_region"
    t.check_constraint "fee_pesewas >= 0", name: "delivery_areas_fee_not_negative"
  end

  create_table "expenses", force: :cascade do |t|
    t.date "spent_on", null: false
    t.string "category", null: false
    t.integer "amount_pesewas", null: false
    t.string "note"
    t.string "paid_via"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["spent_on"], name: "index_expenses_on_spent_on"
    t.index ["user_id"], name: "index_expenses_on_user_id"
    t.check_constraint "amount_pesewas > 0", name: "expenses_amount_positive"
  end

  create_table "live_sessions", force: :cascade do |t|
    t.string "title", null: false
    t.datetime "started_at", null: false
    t.datetime "ended_at"
    t.bigint "user_id", null: false
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sales_channel_id"
    t.index "(1)", name: "index_live_sessions_one_running", unique: true, where: "(ended_at IS NULL)"
    t.index ["sales_channel_id"], name: "index_live_sessions_on_sales_channel_id"
    t.index ["started_at"], name: "index_live_sessions_on_started_at"
    t.index ["user_id"], name: "index_live_sessions_on_user_id"
  end

  create_table "option_presets", force: :cascade do |t|
    t.string "name", null: false
    t.string "option_name", null: false
    t.jsonb "values", default: [], null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((name)::text)", name: "index_option_presets_on_lower_name", unique: true
  end

  create_table "order_items", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.bigint "variant_id", null: false
    t.integer "quantity", null: false
    t.integer "unit_price_pesewas", null: false
    t.integer "unit_cost_pesewas", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "returned_quantity", default: 0, null: false
    t.index ["order_id", "variant_id"], name: "index_order_items_on_order_id_and_variant_id", unique: true
    t.index ["order_id"], name: "index_order_items_on_order_id"
    t.index ["variant_id"], name: "index_order_items_on_variant_id"
    t.check_constraint "quantity > 0", name: "order_items_quantity_positive"
    t.check_constraint "returned_quantity >= 0 AND returned_quantity <= quantity", name: "order_items_returned_within_quantity"
  end

  create_table "orders", force: :cascade do |t|
    t.bigint "customer_id", null: false
    t.bigint "live_session_id"
    t.bigint "user_id"
    t.string "status", default: "claimed", null: false
    t.integer "total_pesewas", default: 0, null: false
    t.datetime "cancelled_at"
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "delivery_method"
    t.integer "delivery_fee_pesewas", default: 0, null: false
    t.text "delivery_address"
    t.integer "paid_pesewas", default: 0, null: false
    t.datetime "paid_at"
    t.datetime "packed_at"
    t.datetime "delivered_at"
    t.datetime "returned_at"
    t.bigint "sales_channel_id"
    t.bigint "delivery_area_id"
    t.string "public_token"
    t.index ["created_at"], name: "index_orders_on_created_at"
    t.index ["customer_id"], name: "index_orders_on_customer_id"
    t.index ["delivery_area_id"], name: "index_orders_on_delivery_area_id"
    t.index ["live_session_id"], name: "index_orders_on_live_session_id"
    t.index ["public_token"], name: "index_orders_on_public_token", unique: true
    t.index ["sales_channel_id"], name: "index_orders_on_sales_channel_id"
    t.index ["status"], name: "index_orders_on_status"
    t.index ["user_id"], name: "index_orders_on_user_id"
    t.check_constraint "delivery_fee_pesewas >= 0", name: "orders_delivery_fee_not_negative"
    t.check_constraint "delivery_method::text = ANY (ARRAY['pickup'::character varying, 'delivery'::character varying]::text[])", name: "orders_delivery_method_known"
    t.check_constraint "paid_pesewas >= 0", name: "orders_paid_not_negative"
    t.check_constraint "status::text = ANY (ARRAY['claimed'::character varying, 'paid'::character varying, 'packed'::character varying, 'delivered'::character varying, 'cancelled'::character varying, 'returned'::character varying]::text[])", name: "orders_status_known"
  end

  create_table "passkeys", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.string "external_id", null: false
    t.text "public_key", null: false
    t.bigint "sign_count", default: 0, null: false
    t.datetime "last_used_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["external_id"], name: "index_passkeys_on_external_id", unique: true
    t.index ["user_id"], name: "index_passkeys_on_user_id"
  end

  create_table "payment_methods", force: :cascade do |t|
    t.string "key", null: false
    t.string "name", null: false
    t.boolean "wants_reference", default: false, null: false
    t.integer "position", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((name)::text)", name: "index_payment_methods_on_lower_name", unique: true
    t.index ["key"], name: "index_payment_methods_on_key", unique: true
  end

  create_table "payments", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.bigint "user_id", null: false
    t.integer "amount_pesewas", null: false
    t.string "via", null: false
    t.string "reference"
    t.string "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_payments_on_order_id"
    t.index ["user_id"], name: "index_payments_on_user_id"
    t.check_constraint "amount_pesewas <> 0", name: "payments_amount_not_zero"
  end

  create_table "product_options", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.string "name", null: false
    t.integer "position", default: 1, null: false
    t.jsonb "values", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "product_id, lower((name)::text)", name: "index_product_options_on_product_and_lower_name", unique: true
    t.index ["product_id"], name: "index_product_options_on_product_id"
  end

  create_table "product_photos", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.integer "position", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id", "position"], name: "index_product_photos_on_product_id_and_position"
    t.index ["product_id"], name: "index_product_photos_on_product_id"
  end

  create_table "product_suppliers", force: :cascade do |t|
    t.bigint "supplier_id", null: false
    t.bigint "product_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id"], name: "index_product_suppliers_on_product_id"
    t.index ["supplier_id", "product_id"], name: "index_product_suppliers_on_supplier_id_and_product_id", unique: true
    t.index ["supplier_id"], name: "index_product_suppliers_on_supplier_id"
  end

  create_table "products", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.integer "price_pesewas", default: 0, null: false
    t.string "status", default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "category_id"
    t.integer "low_stock_at", default: 2, null: false
    t.boolean "listed", default: false, null: false
    t.index "lower((name)::text)", name: "index_products_on_lower_name", unique: true
    t.index ["category_id"], name: "index_products_on_category_id"
    t.index ["listed"], name: "index_products_on_listed", where: "listed"
    t.index ["status"], name: "index_products_on_status"
    t.check_constraint "low_stock_at >= 0", name: "products_low_stock_at_not_negative"
  end

  create_table "purchase_items", force: :cascade do |t|
    t.bigint "purchase_id", null: false
    t.bigint "variant_id", null: false
    t.integer "quantity", null: false
    t.integer "unit_cost_pesewas", null: false
    t.integer "landed_total_pesewas"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "foreign_unit_cost_minor"
    t.index ["purchase_id", "variant_id"], name: "index_purchase_items_on_purchase_id_and_variant_id", unique: true
    t.index ["purchase_id"], name: "index_purchase_items_on_purchase_id"
    t.index ["variant_id"], name: "index_purchase_items_on_variant_id"
    t.check_constraint "quantity > 0", name: "purchase_items_quantity_positive"
  end

  create_table "purchases", force: :cascade do |t|
    t.bigint "supplier_id"
    t.date "purchased_on", null: false
    t.string "reference"
    t.integer "extra_costs_pesewas", default: 0, null: false
    t.string "status", default: "ordered", null: false
    t.datetime "received_at"
    t.text "note"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "delivery_method", null: false
    t.integer "transport_cost_pesewas", default: 0, null: false
    t.string "currency", default: "GHS", null: false
    t.decimal "exchange_rate", precision: 12, scale: 4
    t.index ["purchased_on"], name: "index_purchases_on_purchased_on"
    t.index ["status"], name: "index_purchases_on_status"
    t.index ["supplier_id"], name: "index_purchases_on_supplier_id"
    t.index ["user_id"], name: "index_purchases_on_user_id"
    t.check_constraint "currency::text = 'GHS'::text AND exchange_rate IS NULL OR currency::text <> 'GHS'::text AND exchange_rate > 0::numeric", name: "purchases_rate_matches_currency"
    t.check_constraint "delivery_method::text = ANY (ARRAY['pickup'::character varying, 'delivery'::character varying]::text[])", name: "purchases_delivery_method_known"
  end

  create_table "push_subscriptions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "endpoint", null: false
    t.string "p256dh", null: false
    t.string "auth", null: false
    t.string "topics", default: [], null: false, array: true
    t.string "device"
    t.datetime "last_sent_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["endpoint"], name: "index_push_subscriptions_on_endpoint", unique: true
    t.index ["user_id"], name: "index_push_subscriptions_on_user_id"
  end

  create_table "roles", force: :cascade do |t|
    t.string "name", null: false
    t.string "description"
    t.string "permissions", default: [], null: false, array: true
    t.boolean "system", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "dashboard_layout"
    t.index "lower((name)::text)", name: "index_roles_on_lower_name", unique: true
  end

  create_table "sales_channels", force: :cascade do |t|
    t.string "name", null: false
    t.string "kind", default: "social", null: false
    t.integer "position", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "system_key"
    t.index "lower((name)::text)", name: "index_sales_channels_on_lower_name", unique: true
    t.index ["system_key"], name: "index_sales_channels_on_system_key", unique: true
    t.check_constraint "kind::text = ANY (ARRAY['social'::character varying, 'direct'::character varying]::text[])", name: "sales_channels_kind_known"
  end

  create_table "sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "stock_movements", force: :cascade do |t|
    t.bigint "variant_id", null: false
    t.integer "quantity", null: false
    t.integer "balance_after", null: false
    t.string "reason", null: false
    t.integer "unit_cost_pesewas"
    t.string "source_type"
    t.bigint "source_id"
    t.bigint "user_id"
    t.string "note"
    t.datetime "created_at", null: false
    t.index ["source_type", "source_id"], name: "index_stock_movements_on_source"
    t.index ["user_id"], name: "index_stock_movements_on_user_id"
    t.index ["variant_id", "created_at"], name: "index_stock_movements_on_variant_id_and_created_at"
    t.index ["variant_id"], name: "index_stock_movements_on_variant_id"
    t.check_constraint "quantity <> 0", name: "stock_movements_quantity_not_zero"
  end

  create_table "suppliers", force: :cascade do |t|
    t.string "name", null: false
    t.string "phone"
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "country"
    t.string "region"
    t.bigint "delivery_area_id"
    t.string "location"
    t.index "lower((name)::text)", name: "index_suppliers_on_lower_name", unique: true
    t.index ["delivery_area_id"], name: "index_suppliers_on_delivery_area_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name", null: false
    t.boolean "active", default: true, null: false
    t.bigint "role_id", null: false
    t.string "webauthn_id", null: false
    t.jsonb "dashboard_layout"
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
    t.index ["role_id"], name: "index_users_on_role_id"
    t.index ["webauthn_id"], name: "index_users_on_webauthn_id", unique: true
  end

  create_table "variants", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.string "name", null: false
    t.jsonb "option_values", default: [], null: false
    t.string "combination_key", default: "", null: false
    t.string "sku", null: false
    t.integer "price_pesewas"
    t.integer "position", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "stock_on_hand", default: 0, null: false
    t.integer "average_cost_pesewas", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.index ["product_id", "combination_key"], name: "index_variants_on_product_id_and_combination_key", unique: true
    t.index ["product_id"], name: "index_variants_on_product_id"
    t.index ["sku"], name: "index_variants_on_sku", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "customers", "delivery_areas", on_delete: :nullify
  add_foreign_key "expenses", "users"
  add_foreign_key "live_sessions", "sales_channels", on_delete: :nullify
  add_foreign_key "live_sessions", "users"
  add_foreign_key "order_items", "orders", on_delete: :cascade
  add_foreign_key "order_items", "variants"
  add_foreign_key "orders", "customers"
  add_foreign_key "orders", "delivery_areas", on_delete: :nullify
  add_foreign_key "orders", "live_sessions", on_delete: :nullify
  add_foreign_key "orders", "sales_channels", on_delete: :nullify
  add_foreign_key "orders", "users"
  add_foreign_key "passkeys", "users"
  add_foreign_key "payments", "orders"
  add_foreign_key "payments", "users"
  add_foreign_key "product_options", "products"
  add_foreign_key "product_photos", "products"
  add_foreign_key "product_suppliers", "products", on_delete: :cascade
  add_foreign_key "product_suppliers", "suppliers", on_delete: :cascade
  add_foreign_key "products", "categories", on_delete: :nullify
  add_foreign_key "purchase_items", "purchases", on_delete: :cascade
  add_foreign_key "purchase_items", "variants"
  add_foreign_key "purchases", "suppliers", on_delete: :nullify
  add_foreign_key "purchases", "users"
  add_foreign_key "push_subscriptions", "users", on_delete: :cascade
  add_foreign_key "sessions", "users"
  add_foreign_key "stock_movements", "users"
  add_foreign_key "stock_movements", "variants"
  add_foreign_key "suppliers", "delivery_areas", on_delete: :nullify
  add_foreign_key "users", "roles"
  add_foreign_key "variants", "products"
end
