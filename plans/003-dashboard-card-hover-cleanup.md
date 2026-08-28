# 003 — Fix `.card-hover` transition-all and gate hover for touch

- **Status**: TODO
- **Commit**: 6501b96
- **Severity**: MEDIUM
- **Category**: Performance / Accessibility
- **Estimated scope**: 1 file (`app/globals.css`), ~10 line change

## Problem

`app/globals.css:346-355` defines a `.card-hover` utility, used in `app/admin/dashboard/page.tsx` (grep `card-hover` to confirm current call sites — as of this plan's commit it is only used there):

```css
/* app/globals.css:346-355 — current */
.card-hover {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border);
}

.card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -10px rgba(255, 105, 180, 0.3);
  border-color: var(--primary);
}
```

Two problems:
1. `transition: all` animates every property that changes (including `border-color`, which is fine to animate, but `all` also unnecessarily engages the browser's change-detection machinery for properties that never change on this element — always flagged per this repo's performance rule).
2. The `:hover` rule has no `@media (hover: hover) and (pointer: fine)` gate, so on touch devices tapping the card triggers a lift+shadow effect that can stick until the next tap elsewhere (touch "false hover").

This is the admin dashboard — staff view it multiple times per day — so the fix should keep the effect (it's a legitimate hover affordance on a card, occasional-tier interaction) but make it named-property and touch-safe.

## Target

```css
/* target */
.card-hover {
  border: 1px solid var(--border);
}

@media (hover: hover) and (pointer: fine) {
  .card-hover {
    transition: transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out), border-color 200ms var(--ease-out);
  }

  .card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -10px rgba(255, 105, 180, 0.3);
    border-color: var(--primary);
  }
}
```

Exact values:
- `transition: transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out), border-color 200ms var(--ease-out)` — three named properties, not `all`. 200ms sits in the standard UI band.
- `var(--ease-out)` resolves to `cubic-bezier(0.23, 1, 0.32, 1)` — this token already exists in `app/globals.css` (added in this same round, near the top of the file next to `@custom-variant dark`). Use the token, do not hardcode the cubic-bezier again.
- The entire hover behavior (transition + `:hover` rule) moves inside `@media (hover: hover) and (pointer: fine)` so touch devices get no lift effect and no transition cost at all — the base `.card-hover` class keeps only the static `border`.

## Repo conventions to follow

- `--ease-out` token: defined in `app/globals.css` right after `@custom-variant dark (&:is(.dark *));` as part of this round's changes — reuse it, do not reintroduce a hardcoded `cubic-bezier(0.23, 1, 0.32, 1)` string.
- The hover-gating pattern (`@media (hover: hover) and (pointer: fine)`) is the same guard this round used for button/badge changes conceptually — apply the identical media query verbatim.

## Steps

1. Open `app/globals.css`. Find `.card-hover` and `.card-hover:hover` (search for `/* Enhanced card hover effects for sophisticated theme */`, the comment directly above them).
2. Replace both rules with the Target block above: remove `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);` from `.card-hover` (keep only `border: 1px solid var(--border);`), and wrap a new `.card-hover` (transition only) + `.card-hover:hover` pair inside `@media (hover: hover) and (pointer: fine) { ... }`.
3. Confirm `var(--ease-out)` exists in the file (added earlier this round). If it does not exist when you read the file, define it first: `:root { --ease-out: cubic-bezier(0.23, 1, 0.32, 1); }` near the top, then proceed.

## Boundaries

- Do NOT change `app/admin/dashboard/page.tsx` — this is a CSS-only fix, the class name and its usage stay identical.
- Do NOT touch the unrelated decorative keyframes in the same file (`cosmicGlow`, `fadeInUp`, `scaleIn`, `shimmer`, `float`, `pulse-soft`, `twinkle`) — those are out of scope for this plan.
- Do NOT add a `prefers-reduced-motion` block for this one — a 4px translateY hover-lift is minor enough that this repo's existing reduced-motion coverage (added this round for the drawer, badge pulse, and design reveal) does not need to be extended here; note this as an intentional omission if asked, don't add it speculatively.

## Verification

- **Mechanical**: `pnpm build` completes with no errors. `grep -n "transition: all" app/globals.css` returns no matches after the change.
- **Feel check**: open `/admin/dashboard` on a desktop browser with a mouse — hovering a card should lift it 4px with a smooth 200ms shadow/border transition.
  - Open the same page in Chrome DevTools' device toolbar (touch emulation) or on an actual phone — tapping a card should show no lift/shadow hover effect at all.
  - In DevTools Animations panel, slow playback to 10% and confirm transform/shadow/border move together, no property lagging behind.
- **Done when**: `.card-hover` has no `transition: all`, and the lift effect only fires under `(hover: hover) and (pointer: fine)`.
