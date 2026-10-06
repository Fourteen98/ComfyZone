# Lesson 2: The branded login and the start of the design system

What changed: the login page now carries The Comfy Zone identity, and the
first reusable pieces of the UI exist. No Rails code changed in this step;
the controller, routes and tests are exactly as before. That is the point of
the split: Rails decides *what* happens, React decides *how it looks*.

## 1. Design tokens: one place for the brand

`app/frontend/entrypoints/application.css` now has an `@theme` block:

```css
@theme {
  --color-wine-800: #3f1a22;   /* the monogram */
  --color-taupe-500: #968679;  /* the wall behind it */
  --font-display: 'Cormorant Garamond Variable', serif;
  --font-sans: 'Jost Variable', sans-serif;
}
```

Tailwind reads these and creates classes from them: `bg-wine-800`,
`text-taupe-700`, `font-display`, and so on. Nothing else in the app contains
a brand colour code. To adjust the brand, edit the values here and every
screen follows.

Each colour has a scale from 50 (lightest) to 900 (darkest), so there is
always a matching lighter or darker shade for hovers, borders and backgrounds.

## 2. Reusable components

`app/frontend/components/ui/` is the kit every screen will be built from:

| Component | What it is | Used on the login for |
|---|---|---|
| `Button` | The only button. `variant="primary"` or `"secondary"`, optional `block` | "Log in" |
| `TextField` | Label + input + error message, wired for screen readers | Email, Password |
| `Alert` | A one-line success or error message | Rails flash messages |

The rule: **pages never style a button or an input themselves.** They pick a
component and pass props. That keeps every screen consistent and means a
design change happens in one file.

Compare the login form before and after. Before, each input was about twelve
lines of markup and classes. Now:

```tsx
<TextField
  id="email_address"
  label="Email"
  type="email"
  value={form.data.email_address}
  onChange={(e) => form.setData('email_address', e.target.value)}
  error={form.errors.email_address}
/>
```

Notice `error={form.errors.email_address}`. That value still comes from
`SessionsController#create` in Rails. The component only decides how to show it.

## 3. Images and fonts go through Vite

```tsx
import logoWall from '@/assets/brand/logo-wall.jpg'
...
<img src={logoWall} />
```

Importing an image gives you its URL. In production Vite renames the file with
a fingerprint (`logo-wall-3f9a1c.jpg`) so browsers can cache it forever and
still pick up a new version when it changes. `@` is a shortcut for
`app/frontend`.

The fonts are npm packages (`@fontsource-variable/...`) imported in the CSS,
so they ship with the app and work without access to Google Fonts.

## 4. One layout, two shapes

The login is a single flex container:

```tsx
<div className="flex min-h-dvh flex-col lg:flex-row">
```

`flex-col` stacks logo above form (phones). `lg:flex-row` puts them side by
side from 1024px up. Tailwind prefixes like `lg:` mean "from this screen
width upward", so you always design the phone layout first and add to it.

## Try it yourself

1. **Re-theme in ten seconds.** Change `--color-wine-800` to another colour,
   save, and watch the heading and button change together. Change it back.
2. **Use the kit.** Add `<Button variant="secondary">Test</Button>` somewhere
   on the dashboard. Then remove it.
3. **Read the test.** Run `bin/rails test test/controllers/sessions_controller_test.rb`.
   It still passes untouched, because it checks behaviour (which page, which
   errors), not appearance.
