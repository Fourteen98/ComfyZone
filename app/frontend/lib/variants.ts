import type { OptionValue } from '@/components/OptionValuesEditor'

// One option as it is being edited on the product form.
export type DraftOption = {
  name: string
  /** Every choice on offer for this option (from a list, or typed in). */
  choices: OptionValue[]
  /** The labels she has ticked: the ones this product actually comes in. */
  selected: string[]
}

/** The ticked choices, in the order they are offered. */
export function chosenValues(option: DraftOption): OptionValue[] {
  return option.choices.filter((choice) => option.selected.includes(choice.label))
}

// Every combination of the ticked choices, as display names:
//   Size: M, L  x  Colour: Black, Red  ->  ["M / Black", "M / Red", "L / Black", "L / Red"]
//
// Rails does the real generating (app/models/variant_generator.rb). This
// copy only powers the live preview, so she sees the result before saving.
export function previewVariantNames(options: DraftOption[]): string[] {
  const lists = options.map((option) => chosenValues(option).map((value) => value.label))
  if (lists.length === 0) return []
  if (lists.some((list) => list.length === 0)) return []

  return lists.reduce<string[][]>(
    (combinations, list) => combinations.flatMap((combination) => list.map((label) => [...combination, label])),
    [[]],
  ).map((combination) => combination.join(' / '))
}
