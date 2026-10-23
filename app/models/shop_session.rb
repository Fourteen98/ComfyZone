# One device a shopper is logged in on (see ShopAuthentication).
class ShopSession < ApplicationRecord
  belongs_to :shop_account
  # Logged in this long without coming back: they log in again.
  LASTS = 1.year
end
