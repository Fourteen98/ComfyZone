require "test_helper"

class LiveSessionTest < ActiveSupport::TestCase
  test "names itself and starts now if not told otherwise" do
    live = LiveSession.create!(user: users(:one))

    assert_match(/\ALive, \d+ \w+\z/, live.title)
    assert live.running?
    assert_equal live, LiveSession.current
  end

  test "only one live can run at a time" do
    LiveSession.create!(user: users(:one))

    second = LiveSession.new(user: users(:one), title: "Another")
    assert_not second.save
    assert_includes second.errors[:base].first, "already running"
  end

  test "the database enforces it even if the model is bypassed" do
    LiveSession.create!(user: users(:one))

    assert_raises(ActiveRecord::RecordNotUnique) do
      LiveSession.new(user: users(:one), title: "Sneaky", started_at: Time.current).save!(validate: false)
    end
  end

  test "ending a live frees the way for the next one" do
    live = LiveSession.create!(user: users(:one))

    live.finish!

    assert_not live.running?
    assert_nil LiveSession.current
    assert LiveSession.new(user: users(:one)).save
  end
end
