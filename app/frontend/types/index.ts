// Types shared across the React side.

// Rails flash messages (`redirect_to ..., notice: "Saved"`), exposed by Inertia.
export type FlashData = {
  notice?: string
  alert?: string
}

export type User = {
  id: number
  name: string
  email_address: string
  /** The name of their role, e.g. "Owner". */
  role: string
}

// Must match what `inertia_share` returns in
// app/controllers/inertia_controller.rb. Every page receives these.
export type SharedProps = {
  auth: {
    user: User | null
    /** Permission keys this person holds, e.g. ["products.view", ...]. */
    permissions: string[]
  }
}
