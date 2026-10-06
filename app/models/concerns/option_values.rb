# Shared by OptionPreset and ProductOption: both hold an ordered list of
# choices in a jsonb `values` column, shaped like
#   [{ "label" => "Black", "swatch" => "#1a1a1a" }, { "label" => "M" }]
#
# This code used to live in OptionPreset alone. When a second model needed
# exactly the same behaviour, it moved here. That is when to make a concern:
# on the second use, not before.
module OptionValues
  extend ActiveSupport::Concern

  MAX_VALUES = 80
  HEX_COLOUR = /\A#\h{6}\z/

  included do
    before_validation :tidy_values
    validate :values_make_sense
  end

  def labels
    values.map { |value| value["label"] }
  end

  # True when this is a list of colours (any value carries a swatch).
  def swatches?
    values.any? { |value| value["swatch"].present? }
  end

  private
    # Whatever arrives (from a form, the console or seeds), store one clean shape.
    def tidy_values
      self.values = Array(values).filter_map do |value|
        value = value.to_h.stringify_keys
        label = value["label"].to_s.squish
        next if label.blank?

        swatch = value["swatch"].to_s.strip.downcase.presence
        swatch ? { "label" => label, "swatch" => swatch } : { "label" => label }
      end
    end

    def values_make_sense
      if values.empty?
        errors.add(:values, "need at least one choice")
        return
      end

      errors.add(:values, "can have at most #{MAX_VALUES} choices") if values.size > MAX_VALUES

      repeated = labels.map(&:downcase).tally.select { |_, count| count > 1 }.keys
      errors.add(:values, "has the same choice more than once: #{repeated.join(', ')}") if repeated.any?

      errors.add(:values, "has a choice longer than 30 characters") if labels.any? { |label| label.length > 30 }

      bad = values.select { |value| value["swatch"] && !value["swatch"].match?(HEX_COLOUR) }
      errors.add(:values, "has an invalid colour for #{bad.first['label']}") if bad.any?
    end
end
