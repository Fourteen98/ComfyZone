import { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { listenForConfirms } from '@/lib/confirm'
import type { ConfirmRequest } from '@/lib/confirm'

// The app's one "are you sure?" dialog. Rendered once, in AppLayout; opened
// from anywhere with confirmAction() in lib/confirm.ts.
//
// It is a native <dialog> opened with showModal(). The browser then does the
// hard parts for free: focus is trapped inside, the page behind can't be
// clicked or tabbed to, Escape closes it, and screen readers announce it as
// a dialog.
export default function ConfirmDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  // Tell the message desk that this dialog is here to take questions.
  useEffect(() => {
    listenForConfirms(setRequest)
    return () => listenForConfirms(null)
  }, [])

  // Open when a question arrives.
  useEffect(() => {
    if (request && !dialog.current?.open) dialog.current?.showModal()
  }, [request])

  function answer(yes: boolean) {
    request?.answer(yes)
    setRequest(null)
    dialog.current?.close()
  }

  // "Delete this purchase? Nothing else changes." -> heading + explanation
  const mark = request?.message.indexOf('?') ?? -1
  const heading = request ? (mark === -1 ? request.message : request.message.slice(0, mark + 1)) : ''
  const detail = request && mark !== -1 ? request.message.slice(mark + 1).trim() : ''

  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-heading"
      aria-describedby={detail ? 'confirm-detail' : undefined}
      // Escape, and the phone's back gesture, count as "no".
      onCancel={(event) => {
        event.preventDefault()
        answer(false)
      }}
      // A click on the dimmed area outside the box lands on the <dialog>
      // itself; a click inside lands on one of its children.
      onClick={(event) => event.target === dialog.current && answer(false)}
      // On phones it rises from the bottom, within reach of a thumb; on
      // larger screens it sits in the middle.
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/50 sm:m-auto sm:max-w-md sm:rounded-lg"
    >
      {request && (
        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
          <h2 id="confirm-heading" className="font-display text-2xl font-semibold text-wine-800">
            {heading}
          </h2>
          {detail && (
            <p id="confirm-detail" className="mt-2 text-taupe-800">
              {detail}
            </p>
          )}
          {/* The safe choice comes first in the page, so it is what the
              keyboard focuses when the dialog opens. */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => answer(false)}>
              {request.dismiss ?? 'No, go back'}
            </Button>
            <Button type="button" variant={request.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>
              {request.confirm ?? 'Yes'}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  )
}
