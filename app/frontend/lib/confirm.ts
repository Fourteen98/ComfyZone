// Ask "are you sure?" from anywhere, and wait for the answer:
//
//   if (!(await confirmAction('Delete this purchase? Nothing else changes.', { confirm: 'Delete', danger: true }))) return
//
// The message is one string: the question (up to the first "?") becomes the
// dialog's heading, and anything after it the explanation underneath.
//
// How it works: there is ONE dialog on the page (<ConfirmDialog />, placed
// in AppLayout). This file is the message desk between them. `confirmAction`
// hands the question to whoever is listening and returns a Promise; the
// dialog shows it and, when a button is tapped, settles the Promise with
// true or false. That is why callers can simply `await` the answer, the way
// they would with the browser's own window.confirm, but styled like the app.

export type ConfirmOptions = {
  /** The word on the button that goes ahead: "Delete", "Remove"... */
  confirm?: string
  /** The word on the button that backs out. */
  dismiss?: string
  /** Colour the go-ahead button as destructive. */
  danger?: boolean
}

export type ConfirmRequest = ConfirmOptions & { message: string; answer: (yes: boolean) => void }

let listener: ((request: ConfirmRequest) => void) | null = null

// Called by <ConfirmDialog /> when it appears (and with null when it goes).
export function listenForConfirms(next: typeof listener) {
  listener = next
}

export function confirmAction(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  // No dialog on this page (it should never happen inside AppLayout): fall
  // back to the browser's own, so a destructive action is never unguarded.
  if (!listener) return Promise.resolve(window.confirm(message))

  return new Promise((resolve) => listener!({ ...options, message, answer: resolve }))
}
