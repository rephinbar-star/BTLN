# Unify BTLN brand and page shell

## Scope
- Add one reusable `BrandWordmark` showing exactly `BetweenTheLines`, with capital B/T/L, the approved dark ink for “Between” and “Lines,” and the approved lighter green for “The.”
- Use that wordmark in the compact shared header while preserving the exact 58px mobile and 62px desktop heights, centered geometry, back behavior, menu access, and keyboard support.
- Replace the legacy image-logo footer with the shared compact Start / My reads / Explore navigation on browsing, discovery, and public information pages.
- Keep focused input, checkout, processing, result, and sharing flows free of duplicate tabs when they already use contextual actions.
- Audit every route and shared layout, including legal, guides, pair types, auth, account, Journey, results, shares, errors, comparisons, and admin screens. Remove independently rendered shell logo images while leaving icons, social assets, share-card branding, and animal artwork untouched.
- Preserve direct comparison URLs and indexing, but do not expose comparison links in navigation.
- Update the implementation checklist without reintroducing the removed homepage section or changing product, auth, payment, founder, or entitlement behavior.

## Verification
- Prove through repository-wide searches that no routed header/footer uses the legacy image logo and that only one visible shell wordmark implementation remains.
- Check representative home, pricing, About, pair types, auth, and result screens at 390px and desktop; capture screenshots and verify exact wordmark text/colors, header heights, no horizontal overflow, no bottom-navigation overlap, and menu keyboard/focus behavior.
- Run relevant tests, type checking, and the production build; keep the app unpublished and make no Stripe changes.

## Technical details
- Define semantic brand tokens for exact `#183B35` and `#528A6F`, then consume those tokens from `BrandWordmark`; do not use the darker forest token for “The.”
- Consolidate legacy `Footer` callers into the shared shell navigation or remove the footer where the route is intentionally focused, avoiding `Footer` + `BottomNav` duplication.
- Preserve all current route destinations and safe `return_to` handling.
