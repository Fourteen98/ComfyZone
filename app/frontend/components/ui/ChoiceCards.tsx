import type { LucideIcon } from 'lucide-react'

type Choice<T extends string> = { value: T; label: string; description?: string; icon?: LucideIcon }

type Props<T extends string> = {
  /** The question being asked. Shown above the cards and read by screen readers. */
  legend: string
  /** Groups the radio buttons; must be unique on the page. */
  name: string
  choices: Choice<T>[]
  value: T | ''
  onChange: (value: T) => void
  error?: string | string[]
}

// Two or three big either/or choices, as tappable cards.
// Underneath they are ordinary radio buttons, so the keyboard (arrow keys)
// and screen readers work exactly as people expect. The radio itself is
// visually hidden and the card is styled from its checked state.
export default function ChoiceCards<T extends string>({ legend, name, choices, value, onChange, error }: Props<T>) {
  const message = Array.isArray(error) ? error[0] : error

  return (
    <fieldset>
      <legend className="text-sm font-medium text-taupe-800">{legend}</legend>
      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const Icon = choice.icon
          return (
            <label
              key={choice.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-taupe-300 bg-white p-4 hover:border-wine-700 has-checked:border-wine-800 has-checked:bg-wine-50 has-checked:ring-1 has-checked:ring-wine-800 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-wine-700"
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={value === choice.value}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              {Icon && <Icon className="size-6 shrink-0 text-wine-800" aria-hidden="true" />}
              <span>
                <span className="block font-medium">{choice.label}</span>
                {choice.description && <span className="block text-sm text-taupe-700">{choice.description}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {message && <p className="mt-1.5 text-sm text-red-800">{message}</p>}
    </fieldset>
  )
}
