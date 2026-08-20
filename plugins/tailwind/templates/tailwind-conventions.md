# Tailwind conventions: <repository name>

> Scaffold for the codebase facts a Bootstrap-to-Tailwind migration cannot guess.
> Fill in what you can verify by reading the repository. Leave `TODO` where unsure —
> a `TODO` is honest; a confident wrong path produces code that does not load.
>
> Delete whole sections that do not apply to this stack.

## Autoloading and module casing

**This is the highest-stakes section.** Get it wrong and the code does not autoload —
the failure appears at boot or on first request, not in review.

- **Autoloader:** <e.g. Zeitwerk, classic, PSR-4, none>
- **Acronym / initialism rule:** <does the autoloader expect `Hr`, `HR`, or `hr` for a
  two-letter segment? Name the inflection file that decides it, if any.>

```
# CORRECT
<TODO: a real module/class declaration copied from this repo>

# WRONG — will not autoload
<TODO: the near-miss casing that breaks it>
```

- **Inflection overrides live in:** `<TODO: e.g. config/initializers/inflections.rb, or "none">`

## Directory layout

| Artifact | Path | Notes |
|---|---|---|
| Page views | `<TODO>` | |
| Layout partials | `<TODO>` | |
| Top-level layouts | `<TODO>` | |
| Helpers | `<TODO>` | |
| Components | `<TODO>` | |
| Component styles | `<TODO>` | |
| JS / behaviour controllers | `<TODO>` | |

## Styling build

- **Config file(s):** `<TODO — list every one; note if there is more than one>`
- **Is there more than one config or bundle?** <If yes, say what distinguishes them —
  audience, brand, tenant, locale — and which views resolve to which. A migration that
  edits one config while the view loads the other silently changes nothing.>
- **CSS bundle entry points:** `<TODO>`
- **Per-page stylesheet convention:** `<TODO: naming rule and directory>`
- **Component layer convention:** `<TODO: e.g. @layer components, and where those live>`

## Component conventions

- **Component framework:** <e.g. ViewComponent, Phlex, partials only>
- **File set per component:** `<TODO: e.g. the class, the template, the spec — list all>`
- **Render syntax used in this repo:**

```
<TODO: a real render call copied from this repo>
```

- **When to extract a component vs. a helper method:** <TODO — state the local rule. A
  common one: extract a component when it has state or slots; use a helper when it is
  only a repeated class string. Record which this team prefers and any precedent.>

## Icons

- **Icon system:** `<TODO: e.g. an icon font kit, inline SVG, sprite sheet>`
- **Required markup:** `<TODO — copy a real example, including any accessibility attributes>`

## Interactive behaviour

- **JS framework for view behaviour:** `<TODO: e.g. Stimulus, Alpine, vanilla>`
- **Controller naming and location:** `<TODO>`
- **How markup binds to it:** `<TODO — copy a real example>`

## Audience or tenant segmentation

Only fill this in if the repository serves more than one audience, brand, or tenant.

- **How it is resolved:** `<TODO — name the constraint class, middleware, or helper>`
- **Route scoping:** `<TODO — copy a real route-constraint block>`
- **Parallel view directories:** `<TODO>`

> A migration touching segmented code must state which audience it changes. Editing a
> shared partial while believing it is single-audience is the most common way this work
> breaks a site nobody was testing.

## Branch and PR naming

- **Branch format:** `<TODO>`
- **PR title format:** `<TODO>`

## Bootstrap coexistence

- **Is Bootstrap still loaded alongside Tailwind?** <yes/no>
- **If yes, is rendering a Bootstrap partial from a migrated view acceptable during
  gradual migration?** <TODO — state the local policy, since this decides whether a
  partially-migrated page is shippable.>
- **Known conflicts between the two:** `<TODO — e.g. preflight vs. normalize, grid
  collisions, utility name overlaps>`
