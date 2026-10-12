# A price bargained with the buyer ("6 Amazon pants at GH₵ 180 each",
# though bulk only starts at 10). order_items.agreed remembers that this
# line's price was set by hand: the order page says "Agreed price", the
# reports can show what was given away, and BulkPricing never overwrites it.
class AddAgreedToOrderItems < ActiveRecord::Migration[8.1]
  def change
    add_column :order_items, :agreed, :boolean, null: false, default: false
  end
end
