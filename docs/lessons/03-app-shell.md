# Lesson 3: The app shell and the dashboard structure

What changed: every logged-in page now sits inside a real application frame
(sidebar on desktop, bottom bar on phones), the content uses the full width,
and the dashboard is built from reusable widgets waiting for data.

## 1. A layout is just a component that wraps pages

`app/frontend/layouts/AppLayout.tsx` draws the frame; each page puts itself
inside it:

```tsx
export default function Dashboard(props) {
  return <AppLayout> ...page content... </AppLayout>
}
```

It is the React counterpart of `app/views/layouts/application.html.erb`,
where `{children}` plays the role of `<%= yield %>`.

The same file renders two navigations and shows one of them by screen size:

| Screen | What shows | Tailwind |
|---|---|---|
| Phone | top bar + bottom bar | default classes, hidden with `lg:hidden` |
| Desktop | fixed sidebar | `hidden lg:flex` |

## 2. Navigation is data

`app/frontend/lib/navigation.ts` is a plain list:

```ts
{ label: 'Products', href: '/products', icon: Shirt, ready: false, mobile: true }
```

Both the sidebar and the bottom bar loop over it. When the Products section
is built, flipping `ready` to `true` lights it up in both places. When roles
arrive, each item gets a permission key and the list is filtered per user.

The active item is found with `usePage().url`, the current path that Inertia
keeps up to date as you navigate.

## 3. Widgets, and an honest contract with Rails

New in `components/ui/`:

| Component | Use |
|---|---|
| `PageHeader` | Title, description and action buttons at the top of a page |
| `StatStrip` | A band of headline numbers |
| `Panel` | A titled white surface; the body of every dashboard widget |
| `EmptyState` | What a list shows when it has nothing in it yet |

The dashboard numbers come from Rails:

```ruby
# DashboardController
def stats
  { sales_today: nil, orders_to_pack: nil, low_stock: nil, money_owed: nil }
end
```

They are `nil` because the tables behind them do not exist yet, and React
shows a dash for `nil`. Nothing on screen is made up. As each feature lands,
its `nil` is replaced by a real query and the tile fills in, with no change
needed on the React side. The test in
`test/controllers/dashboard_controller_test.rb` pins the four keys so the two
sides cannot drift apart.

## 4. Money formatting lives in one function

`app/frontend/lib/format.ts` has `formatMoney(pesewas)`. Amounts travel from
Rails as whole pesewas and are turned into `GH₵ 12.50` only at the moment of
display. Every price in the app will go through this one function.

## Try it yourself

1. **Fill a tile.** In `DashboardController#stats` change `orders_to_pack: nil`
   to `orders_to_pack: 3`, and `sales_today: nil` to `sales_today: 125_050`.
   Reload. Then put them back.
2. **Light up a nav item.** In `navigation.ts` set Products to `ready: true`
   and click it. You get a routing error from Rails: the link works, but no
   route exists yet. That error is the starting point of the next lesson.
   Set it back to `false`.
3. **Resize the browser** slowly from wide to narrow and watch the sidebar
   turn into the bottom bar at 1024px.
