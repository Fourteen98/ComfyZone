import { Check } from 'lucide-react'

type Step = {
  label: string
  /** Has this step happened? */
  done: boolean
  /** A short note under the label, e.g. when it happened. */
  note?: string | null
}

// Where something is along a fixed path: Claimed, Paid, Packed, Delivered.
// An ordered list, so screen readers announce "2 of 4"; the tick and the
// colour are decoration on top of words that already say everything.
export default function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex">
      {steps.map((step, index) => (
        <li key={step.label} className="relative min-w-0 flex-1 px-1 text-center">
          {/* The line joining this step to the one before it. */}
          {index > 0 && (
            <span
              aria-hidden="true"
              className={`absolute top-4 right-1/2 -z-0 h-0.5 w-full -translate-y-1/2 ${step.done ? 'bg-wine-800' : 'bg-taupe-200'}`}
            />
          )}
          <span
            className={`relative z-10 mx-auto flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${
              step.done ? 'border-wine-800 bg-wine-800 text-taupe-50' : 'border-taupe-300 bg-white text-taupe-600'
            }`}
          >
            {step.done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
          </span>
          <span className={`mt-1.5 block text-sm font-medium ${step.done ? 'text-ink' : 'text-taupe-600'}`}>
            {step.label}
            {step.done && <span className="sr-only"> (done)</span>}
          </span>
          {/* text-balance splits "7 Oct, 7:04 am" evenly over two lines on a
              phone, where four of them side by side would collide. */}
          {step.note && <span className="block text-xs leading-tight text-balance text-taupe-600">{step.note}</span>}
        </li>
      ))}
    </ol>
  )
}
