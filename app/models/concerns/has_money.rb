# Gives a model friendly money attributes on top of *_pesewas columns.
#
#   class Product < ApplicationRecord
#     include HasMoney
#     money :price            # backed by the price_pesewas column
#   end
#
#   product.price = "120.50"  # stores price_pesewas = 12050
#   product.price             # => "120.50"  (for form fields)
#   product.price_pesewas     # => 12050     (for sums and for React to format)
#
# A "concern" is a module of behaviour shared between models. `money` is a
# class macro, the same kind of thing as `validates` or `has_many`: a method
# that runs when the class is defined and adds methods to it.
module HasMoney
  extend ActiveSupport::Concern

  MAX_PESEWAS = 1_000_000_00 # GH₵ 1,000,000: far above any real price, catches typos

  class_methods do
    # blank_as_zero: an empty box means GH₵ 0 (for optional amounts like fees).
    def money(name, allow_nil: false, blank_as_zero: false)
      column = "#{name}_pesewas"

      define_method(name) { Pesewas.to_input(self[column]) }

      define_method("#{name}=") do |input|
        parsed = Pesewas.parse(input)
        parsed = 0 if parsed.nil? && blank_as_zero
        @unreadable_money ||= {}

        if parsed == Pesewas::INVALID
          # Keep the old value and remember to complain during validation.
          @unreadable_money[name] = true
        else
          @unreadable_money.delete(name)
          self[column] = parsed
        end
      end

      validate do
        if @unreadable_money&.key?(name)
          errors.add(name, "isn't a valid amount. Use numbers like 120 or 120.50")
        elsif self[column].nil?
          errors.add(name, "can't be blank") unless allow_nil
        elsif self[column] > MAX_PESEWAS
          errors.add(name, "is too large")
        end
      end
    end
  end
end
