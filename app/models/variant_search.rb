# Finding a particular size and colour by typing it, in any order:
#
#   VariantSearch.new("orange 3xl").rank(variants)   # best match first
#
# Every typed word must appear somewhere: in the product's name, in one of
# the variant's choices (its name, "3XL / Orange"), or in its SKU. Words are
# matched against the START of words, so "xl" finds XL but not 3XL, and a
# word that is exactly one of the choices counts most.
#
# Done in Ruby rather than SQL: it needs per-word scoring, and the shop's
# whole active catalogue (hundreds of variants) is loaded for the stock
# page anyway. The React twin is app/frontend/lib/search.ts.
class VariantSearch
  SPLIT = %r{[\s,/()-]+}

  attr_reader :words

  def initialize(text)
    @words = text.to_s.downcase.delete_prefix("@").split(%r{[\s,/]+}).reject(&:empty?)
  end

  def blank? = words.empty?

  # 0 = not a match. Higher = better.
  def score(variant)
    name = variant.product.name.downcase.split(SPLIT)
    options = variant.option_values.map { |value| value["label"].to_s.downcase }.flat_map { |label| label.split(SPLIT) }
    sku = variant.sku.to_s.downcase

    words.sum do |word|
      if options.include?(word) then 4
      elsif name.include?(word) then 3
      elsif options.any? { |option| option.start_with?(word) } then 2
      elsif name.any? { |part| part.start_with?(word) } then 2
      elsif sku.include?(word) then 1
      else return 0 # every word must be found somewhere
      end
    end
  end

  # The matching variants, best first (ties keep their original order).
  def rank(variants)
    variants.each_with_index.filter_map { |variant, index| (s = score(variant)).positive? && [ variant, s, index ] }
      .sort_by { |_, s, index| [ -s, index ] }.map(&:first)
  end
end
