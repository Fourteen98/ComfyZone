class Current < ActiveSupport::CurrentAttributes
  attribute :session
  delegate :user, to: :session, allow_nil: true
  # A shopper logged in on the website (ShopAuthentication). Never a member of staff.
  attribute :shop_session
  delegate :shop_account, to: :shop_session, allow_nil: true
end
