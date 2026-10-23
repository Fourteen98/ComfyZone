require "test_helper"

# Resetting many counts at once, and undoing it.
# The Ankara dress: M/Black, M/Red, L/Black, L/Red.
class StockResetTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    @black_m, @red_m, @black_l, @red_l = variants(:dress_m_black, :dress_m_red, :dress_l_black, :dress_l_red)
    { @black_m => 5, @red_m => 3, @black_l => 2 }.each do |variant, count|
      StockLedger.record!(variant: variant, quantity: count, reason: "purchase", total_cost_pesewas: count * 6_000)
    end
    @user = users(:one)
  end

  def counts = [ @black_m, @red_m, @black_l, @red_l ].map { |variant| variant.reload.stock_on_hand }

  test "chosen items go to 0, as recount movements sharing one batch" do
    reset = StockReset.new(user: @user, variant_ids: [ @black_m.id, @red_m.id, @red_l.id ])
    assert reset.save
    assert_equal [ 0, 0, 2, 0 ], counts
    assert_equal 2, reset.changed # L/Red was already 0
    assert_equal "2 items set to 0.", reset.summary

    moves = StockMovement.where(batch: reset.batch)
    assert_equal [ "recount" ], moves.pluck(:reason).uniq
    assert_equal [ "Reset to 0" ], moves.pluck(:note).uniq
    assert_equal [ @user.id ], moves.pluck(:user_id).uniq
    # The average cost is kept, for when stock comes back.
    assert_equal 6_000, @black_m.reload.average_cost_pesewas
  end

  test "or to another number, and negative counts are mended too" do
    StockLedger.record!(variant: @red_l, quantity: -2, reason: "sale")
    assert StockReset.new(user: @user, variant_ids: [ @red_l.id, @black_l.id ], to: "4").save
    assert_equal [ 5, 3, 4, 4 ], counts
  end

  test "a reset makes no 'sold out' notifications" do
    ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = "public", "private"
    assert_no_enqueued_jobs(only: PushJob) do
      StockReset.new(user: @user, variant_ids: [ @black_m.id, @red_m.id ]).save
    end
  ensure
    ENV.delete("VAPID_PUBLIC_KEY")
    ENV.delete("VAPID_PRIVATE_KEY")
  end

  test "a full reset needs the word, and takes everything to 0, archived items too" do
    StockLedger.record!(variant: variants(:old_bag_default), quantity: 1, reason: "found")

    reset = StockReset.new(user: @user, everything: true, confirm: "yes")
    assert_not reset.save
    assert_equal [ "Type RESET to reset everything" ], reset.errors.full_messages
    assert_equal 10, counts.sum

    reset = StockReset.new(user: @user, everything: "true", confirm: " reset ", to: "7") # `to` is ignored
    assert reset.save
    assert_equal [ 0, 0, 0, 0 ], counts
    assert_equal 0, variants(:old_bag_default).reload.stock_on_hand
    assert_equal "Full reset: 4 items set to 0.", reset.summary
  end

  test "nothing chosen, or a count that isn't a number, is refused" do
    assert_equal [ "Choose the sizes or colours to reset first" ], StockReset.new(user: @user, variant_ids: []).tap(&:save).errors.full_messages
    assert_equal [ "The count must be a whole number, like 0 or 5" ],
      StockReset.new(user: @user, variant_ids: [ @black_m.id ], to: "-1").tap(&:save).errors.full_messages
    assert_equal 10, counts.sum
  end

  test "a product counted as one total is reset as a whole" do
    StockPool.pool!(product: products(:dress), total: 10, user: @user)
    assert StockReset.new(user: @user, variant_ids: [ @red_l.id ], to: "6").save # any one size means the product
    assert_equal 6, StockLedger.pool_total(products(:dress))
    assert_equal [ 6, 0, 0, 0 ], counts
  end

  test "undo puts back what the reset changed, keeps later sales, and only once" do
    reset = StockReset.new(user: @user, variant_ids: [ @black_m.id, @red_m.id ], to: "1")
    reset.save
    StockLedger.sell!(variant: @black_m, quantity: 1) # sold after the reset

    assert_equal({ batch: reset.batch, items: 2, note: "Reset to 1", by: @user.name },
      StockReset.latest_undoable.except(:at))

    assert_equal 2, StockReset.undo!(batch: reset.batch, user: @user)
    assert_equal [ 4, 3, 2, 0 ], counts # 5 - 1 sold
    assert_nil StockReset.latest_undoable

    error = assert_raises(ArgumentError) { StockReset.undo!(batch: reset.batch, user: @user) }
    assert_equal "That reset has already been undone", error.message
    assert_raises(ArgumentError) { StockReset.undo!(batch: "nope", user: @user) }
  end

  test "undo is offered for a day" do
    reset = StockReset.new(user: @user, variant_ids: [ @black_m.id ])
    reset.save
    travel 25.hours do
      assert_nil StockReset.latest_undoable
    end
  end
end
