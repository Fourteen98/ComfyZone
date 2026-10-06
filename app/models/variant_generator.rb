# Keeps a product's variants in step with its options.
#
# Given   Size: M, L   and   Colour: Black, Red
# it makes sure exactly these variants exist, in this order:
#   M / Black,  M / Red,  L / Black,  L / Red
#
# This is a "plain old Ruby object" (PORO): not a model, not a controller,
# just a small class with one job. When a piece of logic involves several
# models and doesn't belong to any single one, give it its own class.
class VariantGenerator
  def initialize(product)
    @product = product
  end

  # Every combination of the product's option values.
  # No options -> one empty combination -> one "Default" variant.
  def combinations
    lists = @product.options.reload.map do |option|
      option.values.map { |value| value.merge("name" => option.name) }
    end
    return [ [] ] if lists.empty?

    # Array#product is the "every combination" operation:
    #   [1, 2].product([:a, :b]) # => [[1, :a], [1, :b], [2, :a], [2, :b]]
    lists.first.product(*lists.drop(1))
  end

  # Create what is missing, keep what still applies (with its price and
  # stock), bring back anything that was retired, and retire or remove what
  # no longer applies.
  def sync!
    existing = @product.all_variants.reload.index_by(&:combination_key)

    kept_ids = combinations.each_with_index.map do |combination, index|
      key = Variant.key_for(combination)
      variant = existing[key] || @product.all_variants.build(combination_key: key)
      variant.update!(option_values: combination, name: Variant.name_for(combination), position: index + 1, active: true)
      variant.id
    end

    @product.all_variants.where.not(id: kept_ids).find_each do |variant|
      # A variant with purchases or stock history can't be deleted without
      # leaving that history pointing at nothing, so it is switched off.
      variant.has_history? ? variant.update!(active: false) : variant.destroy!
    end

    @product.variants.reset
  end
end
