require "test_helper"

class ReportPeriodTest < ActiveSupport::TestCase
  # travel_to freezes the clock, so "today" is the same every time the test
  # runs. Wednesday 7 October 2026.
  setup { travel_to Time.zone.local(2026, 10, 7, 15, 0) }

  def dates(key)
    period = ReportPeriod.preset(key)
    [ period.from.iso8601, period.to.iso8601 ]
  end

  test "presets" do
    assert_equal %w[ 2026-10-07 2026-10-07 ], dates("today")
    assert_equal %w[ 2026-10-06 2026-10-06 ], dates("yesterday")
    assert_equal %w[ 2026-10-05 2026-10-07 ], dates("week") # Monday to today
    assert_equal %w[ 2026-10-01 2026-10-07 ], dates("month")
    assert_equal %w[ 2026-09-01 2026-09-30 ], dates("last_month")
    assert_equal %w[ 2026-09-08 2026-10-07 ], dates("30days")
  end

  test "an unknown range falls back to this week" do
    assert_equal "week", ReportPeriod.from_params(range: "forever").key
    assert_equal "week", ReportPeriod.from_params({}).key
  end

  test "custom dates, in either order" do
    period = ReportPeriod.from_params(range: "custom", from: "2026-09-20", to: "2026-09-10")

    assert_equal [ "custom", Date.new(2026, 9, 10), Date.new(2026, 9, 20), 11 ], [ period.key, period.from, period.to, period.days ]
  end

  test "unreadable custom dates fall back, and a huge span is trimmed" do
    assert_equal "week", ReportPeriod.from_params(range: "custom", from: "soon", to: "").key
    assert_equal ReportPeriod::MAX_DAYS, ReportPeriod.custom("1990-01-01", "2026-10-07").days
  end

  test "the range covers whole days" do
    range = ReportPeriod.preset("yesterday").range

    assert range.cover?(Time.zone.local(2026, 10, 6, 0, 0, 0))
    assert range.cover?(Time.zone.local(2026, 10, 6, 23, 59, 59))
    assert_not range.cover?(Time.zone.local(2026, 10, 7, 0, 0, 0))
  end

  test "the previous period is the same length, just before" do
    previous = ReportPeriod.preset("week").previous

    assert_equal [ Date.new(2026, 10, 2), Date.new(2026, 10, 4) ], [ previous.from, previous.to ]
  end

  test "labels" do
    assert_equal "7 Oct 2026", ReportPeriod.preset("today").label
    assert_equal "5 to 7 Oct 2026", ReportPeriod.preset("week").label
    assert_equal "8 Sep to 7 Oct 2026", ReportPeriod.preset("30days").label
    assert_equal "20 Dec 2025 to 5 Jan 2026", ReportPeriod.custom("2025-12-20", "2026-01-05").label
  end
end
