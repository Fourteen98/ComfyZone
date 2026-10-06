# Lesson 5: Option presets (sizes, lengths, colours)

What changed: Settings has a new **Options** tab holding ready-made lists of
choices. Seven lists are seeded: letter sizes, UK dress sizes, waist sizes,
shoe sizes, free size, lengths and colours. These are what she will pick from
when adding a product in the next step.

After pulling this step, run:

```sh
bin/rails db:migrate
bin/rails db:seed
```

This is the second full feature, and it deliberately follows the same shape
as roles. Open `settings/roles_controller.rb` and
`settings/option_presets_controller.rb` side by side: same six actions, same
skeleton. Once you can read one, you can read every controller in the app.

## 1. A jsonb column for an ordered list

```ruby
t.jsonb :values, null: false, default: []
```

One preset row stores its whole list:

```json
[{ "label": "Black", "swatch": "#1a1a1a" }, { "label": "Red", "swatch": "#c0262d" }]
```

**The order of the array is the display order.** That is the whole answer to
"how do sizes come out S, M, L, XL instead of alphabetical": nothing sorts
them. They are stored in the order she arranged them.

Why one column and not an `option_values` table with a `position` column?
A separate table earns its keep when rows are looked up, linked to or
counted on their own. These values are only ever read and saved together
with their preset, and products *copy* them. In that situation a jsonb
column means one query, one save, and no reordering logic.

Compare with roles, where `permissions` is a plain Postgres **array** of
strings. Use an array for a list of simple values; use jsonb when each item
has fields of its own (here, label and swatch).

In the console:

```ruby
preset = OptionPreset.find_by(name: "Colours")
preset.values.first      # => {"label"=>"Black", "swatch"=>"#1a1a1a"}
preset.labels            # => ["Black", "White", ...]
```

## 2. Cleaning input in the model

`before_validation :tidy_values` runs every time a preset is saved, no matter
where the data came from: the form, the console, or seeds. It trims spaces,
drops blanks, and lower-cases colour codes, so there is exactly one stored
shape. Then `values_make_sense` rejects duplicates and bad colours.

The order matters and is a general pattern:

```
before_validation  ->  tidy the input
validate           ->  refuse what is still wrong
before_create      ->  fill in things only new records need (position)
```

`normalizes :name, with: ->(t) { t.squish }` is the one-line version of the
same idea for simple text fields.

## 3. Strong parameters for nested data

```ruby
params.expect(option_preset: [ :name, :option_name, values: [ [ :label, :swatch ] ] ])
```

- `permissions: []` (in roles) allows an array of plain values.
- `values: [[ :label, :swatch ]]`, with double brackets, allows an array of
  hashes with exactly those keys.

Anything not listed is dropped before it reaches the model.

## 4. Routes can have friendlier URLs

```ruby
resources :option_presets, path: "options", except: :show
```

The URL is `/settings/options`, while the controller, model and path helpers
keep the precise name `option_presets`. Run `bin/rails routes -g option`.

## 5. A controlled component, built to be reused

`app/frontend/components/OptionValuesEditor.tsx` edits the list: add several
at once ("S, M, L, XL" then Enter), rename, reorder, remove.

It holds no data of its own. The page gives it `values` and receives every
change through `onChange`:

```tsx
<OptionValuesEditor
  values={form.data.values}
  onChange={(values) => form.setData('values', values)}
  withSwatches={colours}
/>
```

Because the data lives in the parent's `useForm`, the same editor can be
dropped into the product form next step without changes. That is what
"reusable component" means in practice: it does one job and owns nothing.

`Chip` and `Swatch` in `components/ui/` are the display side, and will show
option values everywhere from here on.

## 6. Seeds that respect her edits

```ruby
OptionPreset.find_or_create_by!(name: "Lengths") do |preset|
  preset.values = [...]
end
```

The block runs only when the preset does not exist yet. If she renames a
colour or removes a size, running `db:seed` again leaves her version alone.

## Try it yourself

1. **Add a list** called "Bra sizes" describing "Size": type
   `32B, 34B, 34C, 36C` and press Enter.
2. **Reorder** the colours so her best sellers come first.
3. **In the console**, try to break the rules and read the errors:
   ```ruby
   p = OptionPreset.new(name: "Test", option_name: "Size", values: [{ label: "M" }, { label: "m" }])
   p.valid?
   p.errors.full_messages
   ```
4. **Edit a seeded list** in the app, then run `bin/rails db:seed` and
   confirm your edit survived.
