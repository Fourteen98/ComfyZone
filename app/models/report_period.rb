# The stretch of days a report covers.
#
#   period = ReportPeriod.from_params(range: "week")
#   period.from, period.to     # Dates, both included
#   period.range               # a Time range for `where(created_at: ...)`
#   period.previous            # the same number of days just before
#
# A small plain Ruby object (no table). It exists so that "what does
# 'this week' mean?" is answered in exactly one place.
class ReportPeriod
  PRESETS = {
    "today"      => "Today",
    "yesterday"  => "Yesterday",
    "week"       => "This week",
    "month"      => "This month",
    "last_month" => "Last month",
    "30days"     => "Last 30 days"
  }.freeze
  DEFAULT = "week"
  MAX_DAYS = 731 # two years: plenty, and stops a typo asking for a century

  attr_reader :key, :from, :to

  def self.from_params(params)
    key = params[:range].to_s
    return custom(params[:from], params[:to]) if key == "custom"

    preset(PRESETS.key?(key) ? key : DEFAULT)
  end

  def self.preset(key)
    # Date.current is today in the app's time zone (config.time_zone), not
    # the server's. Never use Date.today in a Rails app.
    today = Date.current
    from, to =
      case key
      when "today"      then [ today, today ]
      when "yesterday"  then [ today - 1, today - 1 ]
      when "week"       then [ today.beginning_of_week, today ] # weeks start on Monday
      when "month"      then [ today.beginning_of_month, today ]
      when "last_month" then [ today.last_month.beginning_of_month, today.last_month.end_of_month ]
      when "30days"     then [ today - 29, today ]
      end
    new(key: key, from: from, to: to)
  end

  # Dates typed by hand. Anything unreadable falls back to the default.
  def self.custom(from, to)
    from = Date.iso8601(from.to_s)
    to = Date.iso8601(to.to_s)
    from, to = to, from if from > to
    from = to - (MAX_DAYS - 1) if (to - from) >= MAX_DAYS
    new(key: "custom", from: from, to: to)
  rescue Date::Error
    preset(DEFAULT)
  end

  def initialize(key:, from:, to:)
    @key, @from, @to = key, from, to
  end

  # Midnight at the start of the first day to the last instant of the last
  # day, in the business's time zone.
  def range
    from.beginning_of_day..to.end_of_day
  end

  def days
    (to - from).to_i + 1
  end

  # The same number of days immediately before, for "up 12% on the week before".
  def previous
    self.class.new(key: "custom", from: from - days, to: from - 1)
  end

  # "6 Oct 2026", "1 to 6 Oct 2026", "28 Sep to 4 Oct 2026"
  def label
    return from.strftime("%-d %b %Y") if from == to

    start = from.strftime(from.year == to.year ? (from.month == to.month ? "%-d" : "%-d %b") : "%-d %b %Y")
    "#{start} to #{to.strftime('%-d %b %Y')}"
  end
end
