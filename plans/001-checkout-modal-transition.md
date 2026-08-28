# 001 — Add enter/exit transition to the checkout modal

- **Status**: TODO
- **Commit**: 6501b96
- **Severity**: HIGH
- **Category**: Physicality & origin / Interruptibility
- **Estimated scope**: 1 file (`components/catalog/checkout-modal.tsx`), ~15 line change

## Problem

`components/catalog/checkout-modal.tsx` is a hand-rolled modal (it does not use the shadcn `Dialog` component — there is no `Dialog` import anywhere in the file). It teleports in and out with no transition at all:

```tsx
// components/catalog/checkout-modal.tsx:194
if (!isOpen) return null

return (
  <>
    <div className="fixed inset-0 bg-black/50 z-50" onClick={handleClose} />
    {/* modal content */}
```

This is the highest-traffic conversion moment in the app — every customer who buys something sees this modal — and it currently teleports with zero motion, unlike every admin CRUD dialog in this codebase (which correctly uses shadcn's `Dialog` and already animates via `data-[state=open]:animate-in ... fade-in-0 zoom-in-95`, see `components/ui/dialog.tsx:63`).

## Target

```tsx
// target
export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  // ...existing state...

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-250 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={handleClose}
      />
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-4",
          isOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!isOpen}
      >
        <div
          className={cn(
            "bg-card rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transition-[opacity,transform] duration-250 ease-out",
            isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95",
          )}
        >
          {/* existing modal content, unchanged */}
        </div>
      </div>
    </>
  )
}
```

Exact values:
- `transition-opacity duration-250 ease-out` on the overlay (matches the 250ms band for modals: 200-500ms).
- `transition-[opacity,transform] duration-250 ease-out` on the modal panel — name the exact properties, never `transition-all`.
- Enter/exit state: `opacity-100 scale-100` ↔ `opacity-0 scale-95` — **never `scale-0`**. `scale-95` is within the sanctioned 0.9–0.97 range.
- `transform-origin: center` (the Tailwind default — do not set `transform-origin` explicitly). Modals are exempt from trigger-anchoring; center is correct here.
- `aria-hidden={!isOpen}` and `pointer-events-none` when closed, so the invisible panel never intercepts clicks or gets focus.

## Repo conventions to follow

- This exact pattern (always-mounted, `isOpen`-driven `translate`/`scale`/`opacity` classes via `cn()`, `pointer-events-none` when closed, `aria-hidden`) was just implemented in `components/catalog/cart-sidebar.tsx` for the cart drawer — copy that structure, not the drawer's `translateX` (this is a centered modal, not a drawer, so use `scale` + `opacity`, no `translate`).
- `cn` comes from `@/lib/utils` — the cart-sidebar import is `import { cn } from "@/lib/utils"`.
- Duration: this repo's shared convention (see `app/catalogo/disenar/page.tsx`'s `.design-reveal` and the cart drawer) is to inline exact Tailwind duration/ease utilities or a dedicated CSS class in `app/globals.css` — either is acceptable; prefer inline Tailwind classes here since no other component needs to share this exact transition.

## Steps

1. Open `components/catalog/checkout-modal.tsx`. Add `import { cn } from "@/lib/utils"` near the top with the other imports.
2. Replace `if (!isOpen) return null` (line 194) — delete this line entirely. The component must always render.
3. Find the outer `return (<> <div className="fixed inset-0 bg-black/50 z-50" onClick={handleClose} /> ...` block. Wrap the overlay div and the modal panel div exactly as shown in the Target section above, preserving every existing prop, state variable, and all child JSX of the modal panel unchanged — only the wrapping `className` and structure around it changes.
4. Confirm the component that renders `<CheckoutModal isOpen={checkoutOpen} ... />` (in `app/catalogo/page.tsx`) does **not** conditionally wrap it (e.g. `{checkoutOpen && <CheckoutModal .../>}`). If it does, remove that conditional — the component must always be mounted for the exit transition to play. (As of this plan's commit, `app/catalogo/page.tsx` already renders it unconditionally — verify this is still true before editing.)

## Boundaries

- Do NOT touch the modal's internal form fields, state, or submit logic — only the mount/visibility wrapper.
- Do NOT migrate this to shadcn's `Dialog` component. That is a larger, separate refactor (would also need focus-trap/Escape-key handling audited) and out of scope for this plan.
- Do NOT add any new dependency.
- If `checkout-modal.tsx` no longer contains `if (!isOpen) return null` at the time you read it (drift since commit `6501b96`), STOP and report instead of guessing where the mount logic moved to.

## Verification

- **Mechanical**: `pnpm build` (or `npx next build`) completes with no TypeScript/ESLint errors.
- **Feel check**: open `/catalogo`, log in as a portal client, add an item to the cart, click "Proceder al Pago" to open checkout, then close it (X button and clicking the overlay).
  - The modal should scale up from 95% while fading in, not teleport into view.
  - Closing should fade/scale back down, not vanish instantly.
  - In DevTools Animations panel, set playback to 10% and confirm opacity and scale move together, not staggered oddly.
  - Toggle `prefers-reduced-motion: reduce` (DevTools Rendering panel) — confirm the modal still appears/disappears (via the `duration-250` transition, which is short enough to leave as-is per this repo's existing reduced-motion pattern in `app/globals.css`; if a stricter cross-fade-only variant is desired, that's a follow-up, not required for this plan).
- **Done when**: the checkout modal never appears or disappears without the fade+scale transition, in both open and close directions, and the build is clean.
