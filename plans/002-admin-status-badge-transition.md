# 002 — Transition on admin activo/inactivo status badges

- **Status**: TODO
- **Commit**: 6501b96
- **Severity**: MEDIUM
- **Category**: Interruptibility / Accessibility (state indication)
- **Estimated scope**: 4 files, one-line change each

## Problem

Across the admin CRUD pages, toggling a record's active/inactive status flips the status `Badge`'s color and text instantly, with no transition, even though the `Badge` component itself is a simple presentational element that already supports `className`:

```tsx
// app/admin/inventario/page.tsx:432-433
<Badge variant={producto.activo ? "default" : "secondary"}>
  {producto.activo ? "Activo" : "Inactivo"}
</Badge>
```

The same pattern (`variant={x.activo ? "default" : "secondary"}` with no transition) repeats for servicios in the same file (`app/admin/inventario/page.tsx:517`), and is expected to repeat in the clientes and productos/servicios list pages that show the same kind of status badge (`app/admin/clientes/page.tsx`, any other page rendering an activo/inactivo `Badge` driven by `handleToggleStatus`). Confirm the exact set of files by grepping for `Badge variant={` combined with `.activo` in `app/admin/**/page.tsx` before starting — do not assume the list above is exhaustive.

This is an admin-facing, occasional-frequency interaction (a staff member toggles a product/client/service off occasionally, not dozens of times a minute) — a state indication purpose, not decoration. The instant flip is a "preventing jarring change" gap, not a "shouldn't animate" case.

## Target

```tsx
// target — app/admin/inventario/page.tsx:432 (and every equivalent status badge)
<Badge
  className="transition-[background-color,color] duration-200 ease"
  variant={producto.activo ? "default" : "secondary"}
>
  {producto.activo ? "Activo" : "Inactivo"}
</Badge>
```

Exact values:
- `transition-[background-color,color] duration-200 ease` — name the two properties that actually change (the `Badge` component swaps Tailwind variant classes, which only affects `background-color` and `text color`). 200ms sits inside the "dropdowns/selects" band (150–250ms) which is the closest analog for a discrete state swap.
- Easing: `ease` (not `ease-out`) — this is a hover/color-change-class transition per the easing decision table, not an entering/exiting element.
- No `transform` needed here — this is a color-only state indication, not a spatial or entrance animation.

## Repo conventions to follow

- The shared `Badge` component (`components/ui/badge.tsx`) already accepts and forwards `className` — confirm this before editing (it uses `cva` + `cn()` like `Button`, so a passed `className` merges correctly with the variant classes; do not modify `badge.tsx` itself, just pass `className` at each call site).
- Match the exact `transition-[property,property]` array syntax already used in this codebase's button base classes (`components/ui/button.tsx`, updated in this same round): `transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out`. This plan's badges use `ease` instead of `ease-out` deliberately (color-change, not entrance) — do not copy the button's `ease-out` here.

## Steps

1. Run `grep -rn "Badge variant={.*\.activo" app/admin --include="*.tsx"` to get the exact, current list of call sites. Expect at least `app/admin/inventario/page.tsx` (productos and servicios tabs) and likely `app/admin/clientes/page.tsx`; there may be others (proveedores) — include every match.
2. For each match, add `className="transition-[background-color,color] duration-200 ease"` to that `<Badge>` element. Do not change the `variant` logic, the conditional text, or anything else about the element.
3. If a matched `<Badge>` already has a `className` prop (unlikely for these specific status badges, but check), merge the new classes into the existing string rather than overwriting it.

## Boundaries

- Do NOT touch `components/ui/badge.tsx` itself — this is a per-call-site `className` addition, not a component-level change.
- Do NOT add this transition to unrelated `Badge` usages (e.g. cart item counts, role labels, community-style tags) — scope is strictly the activo/inactivo status badges driven by a toggle action.
- Do NOT change `handleToggleStatus` or any state/data logic.
- If a matched file's badge markup differs materially from the excerpt above (e.g. it's not a direct `variant={x.activo ? ... }` ternary), STOP and report the discrepancy rather than guessing the right conditional.

## Verification

- **Mechanical**: `pnpm build` completes with no errors.
- **Feel check**: in `/admin/inventario`, click "Inhabilitar"/"Habilitar" on a product or service.
  - The badge's background/text color should cross-fade over ~200ms, not snap instantly.
  - Repeat on `/admin/clientes` (and any other page touched) to confirm consistency.
  - In DevTools Animations panel, slow playback to 10% and confirm only color properties move — no layout shift, no flicker of a third color mid-transition.
- **Done when**: every activo/inactivo status badge in the admin panel cross-fades on toggle instead of snapping.
