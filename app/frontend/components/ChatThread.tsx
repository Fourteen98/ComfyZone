import { AlertCircle, Check, CheckCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'

export type ChatMessage = {
  id: number
  direction: 'in' | 'out'
  kind: string
  text: string | null
  image: string | null
  choices: { id: string; title: string; description?: string | null }[] // the bot's buttons and list rows
  status: string // received, simulated, sent, delivered, read, failed
  error: string | null
  by: string | null // staff who typed it
  at: string
}

type Props = {
  messages: ChatMessage[]
  /** "Try it": tapping one of the bot's choices sends it, as a customer would. */
  onChoose?: (choice: { id: string; title: string }) => void
  /** Only the last message's choices can be tapped (like WhatsApp itself). */
  height?: string
}

// A WhatsApp-style thread: the customer on the left, the shop on the right.
// WhatsApp's *bold* is shown bold; the bot's buttons and list rows sit
// under its message.
export default function ChatThread({ messages, onChoose, height = 'max-h-[60vh]' }: Props) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length])
  const lastOut = [...messages].reverse().find((message) => message.direction === 'out')?.id

  return (
    <div className={`${height} space-y-2 overflow-y-auto bg-[#efeae2] p-3`} role="log" aria-label="Messages">
      {messages.length === 0 && <p className="py-8 text-center text-sm text-taupe-600">No messages yet.</p>}
      {messages.map((message) => {
        const mine = message.direction === 'out'
        return (
          <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${mine ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
              {message.by && <p className="mb-0.5 text-xs font-medium text-wine-800">{message.by}</p>}
              {message.image && <img src={message.image} alt="" className="mb-1.5 max-h-48 rounded-md object-cover" />}
              <p className="break-words whitespace-pre-wrap">{bold(message.text ?? '')}</p>
              {message.choices.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-black/10 pt-2">
                  {message.choices.map((choice) => {
                    const live = onChoose && message.id === lastOut
                    return (
                      <li key={choice.id}>
                        <button
                          type="button"
                          disabled={!live}
                          onClick={() => live && onChoose(choice)}
                          className="w-full rounded-md bg-white/70 px-2.5 py-1.5 text-left font-medium text-[#027eb5] enabled:hover:bg-white disabled:cursor-default"
                        >
                          {choice.title}
                          {choice.description && <span className="block text-xs font-normal text-taupe-600">{choice.description}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-taupe-500">
                {message.at}
                {mine && <Tick status={message.status} />}
              </p>
              {message.status === 'failed' && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-800">
                  <AlertCircle className="size-3.5" aria-hidden="true" />
                  Not delivered{message.error ? `: ${message.error}` : ''}
                </p>
              )}
            </div>
          </div>
        )
      })}
      <div ref={end} />
    </div>
  )
}

// WhatsApp's ticks: one (sent), two (delivered), two blue (read). A
// simulated message (no keys yet, or "Try it") has none.
function Tick({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="size-3.5 text-sky-600" aria-label="Read" />
  if (status === 'delivered') return <CheckCheck className="size-3.5" aria-label="Delivered" />
  if (status === 'sent') return <Check className="size-3.5" aria-label="Sent" />
  if (status === 'simulated') return <span className="italic">not sent (test)</span>
  return null
}

// *bold* the way WhatsApp shows it.
function bold(text: string) {
  return text
    .split(/(\*[^*\n]+\*)/g)
    .map((part, index) =>
      part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <strong key={index}>{part.slice(1, -1)}</strong> : part,
    )
}
