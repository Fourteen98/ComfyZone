type Choice<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  /** The question being asked. Shown above the pills and read by screen readers. */
  legend: string
  /** Groups the radio buttons; must be unique on the page. */
  name: string
  choices: Choice<T>[]
  value: T | ''
  onChange: (value: T) => void
  error?: string | string[]
  /** For use on a dark (wine) background. */
  inverted?: boolean
}

// Pick one of a handful of short options, as a row of pills.
// The small sibling of ChoiceCards: same idea (real radio buttons, hidden,
// with the pill styled from the radio's state), for when the options are
// one or two words each and there may be four or five of them.
export default function ChoicePills<T extends string>({ legend, name, choices, value, onChange, error, inverted = false }: Props<T>) {
  const message = Array.isArray(error) ? error[0] : error

  return (
    <fieldset>
      <legend className={`text-sm font-medium ${inverted ? 'text-taupe-200' : 'text-taupe-800'}`}>{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium has-focus-visible:outline-2 has-focus-visible:outline-offset-2 ${
              inverted
                ? 'border-taupe-50/40 hover:border-taupe-50 has-checked:border-taupe-50 has-checked:bg-taupe-50 has-checked:text-wine-800 has-focus-visible:outline-taupe-50'
                : 'border-taupe-300 bg-white hover:border-wine-700 has-checked:border-wine-800 has-checked:bg-wine-800 has-checked:text-taupe-50 has-focus-visible:outline-wine-700'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            {choice.label}
          </label>
        ))}
      </div>
      {message && <p className="mt-1.5 text-sm text-red-800">{message}</p>}
    </fieldset>
  )
}
