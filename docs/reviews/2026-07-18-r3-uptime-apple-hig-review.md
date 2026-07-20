# r3-uptime — Apple HIG Visual UI Review

- **Date:** 2026-07-18
- **App:** `apps/r3-uptime` running at `localhost:3000` (dev server), authenticated session, team `sergiodxa-team`
- **Criteria:** the 10 rules in `.agents/skills/apple-hig-web-app-guidelines` (cited by slug below)
- **Method:** every page reviewed at 390×844 (mobile) and 1440×900 (desktop) with screenshots, accessibility-tree snapshots, `getBoundingClientRect` measurements of interactive targets, and `prefers-color-scheme: dark` passes. Findings verified against source where possible (file:line refs). No forms were submitted and no destructive actions were clicked.

## Summary

The app's bones are right: navigation splits correctly by device class (persistent labeled sidebar on desktop, drawer on mobile), dark mode is systematically themed on every surface checked, empty states are textbook, destructive actions follow the HIG confirmation pattern faithfully, and forms are almost fully labeled with explicit-verb submits. There is no fake native chrome, no external font loading, and no horizontal page overflow at 390px.

The failures are concentrated and mostly systemic rather than scattered: **mobile ergonomics** (nothing in the app reaches the 44px touch minimum; header actions truncate titles and can clip entirely off-screen), **document semantics** (the per-page `<h1>` was deliberately replaced by a styled `<span>`, so no app page has a heading outline), and a handful of **form-clarity** gaps. Because the causes live in shared components (`button.tsx`, `app-shell.tsx`, `tabs.tsx`), a small number of fixes clears findings across every page at once.

Counts: **4 High, 13 Medium, 17 Low** (systemic findings counted once).

---

## High

### H1. Nothing in the app meets the 44×44px touch target minimum on mobile

**Rule:** `touch-pointer-keyboard-targets` · **Viewport:** mobile · **Scope:** every page reviewed (all four reviewers independently reported it)

Measured at 390×844: nav toggle 32×32 (the only path to primary navigation), drawer nav rows 32px tall, text inputs/selects/submit buttons 34–36px, dashboard tabs 28px, empty-state CTAs 38px, checkboxes 13×13 in 19px label rows, breadcrumb/text links 14–19px tall. Sizes are identical on desktop and mobile — desktop density is served to touch users, where the rule asks for "fewer controls on mobile, not smaller controls."

Root causes are shared, so the fix is cheap relative to its reach:

- `apps/r3-uptime/resources/components/button.tsx:56-58` — size mixins are padding-only (`sm: 6px/12px`, `md: 8px/16px`, `lg: 10px/20px`), no `minHeight`. A `minHeight: "2.75rem"` at the mobile breakpoint fixes every button/CTA app-wide.
- `apps/r3-uptime/resources/layouts/app-shell.tsx:102-118` — nav toggle fixed at `width: 32, height: 32`.
- `apps/r3-uptime/resources/layouts/app-shell.tsx:412-427` — `navLink` is `padding: "8px 12px"` with no mobile min-height (32px drawer rows).
- Checkbox rows (monitor edit, cron new, status-page new, api-key new) need taller label rows and spacing — 19px rows of adjacent destructive-adjacent toggles are well under guidance.

### H2. Monitors table: row actions are unreachable-in-practice on mobile

**Rule:** `gestures-need-visible-alternatives` · **Viewport:** mobile · **Page:** `/app/:team/monitors`

The table renders 617px wide inside a 350px `overflow-x: auto` wrapper. At load, Response Time, Last Checked, and the Actions kebab are all past the right edge, and there is no scroll affordance — reaching View/Edit/Delete requires discovering a hidden sideways swipe, which the rule explicitly forbids as the only path to a task. Desktop is fine (visible kebab per row with proper accessible names).

Fix direction: on narrow viewports collapse the table to stacked cards/rows with primary metadata only (per `responsive-density-and-chrome`'s list guidance), keeping the actions menu visible; or at minimum pin the actions column.

### H3. Monitor detail: third header action clips fully off-screen on mobile

**Rule:** `responsive-density-and-chrome` · **Viewport:** mobile · **Page:** `/app/:team/monitors/:id`

At 390px the header renders "Run Monitor" and "Edit Monitor" wrapped to two lines each, and "Refresh" is laid out at x=400 (width 115) — entirely outside the viewport inside a clipped container, with no overflow menu. The action cannot be reached at all on mobile.

- `apps/r3-uptime/resources/layouts/app-shell.tsx:81-92` — the `page` container sets `overflow: "hidden"` (verified).
- `apps/r3-uptime/resources/layouts/app-shell.tsx:711` — `actions` render in a plain non-wrapping flex `row` with no mobile collapse (verified).

Fix direction: on mobile keep one primary header action and move the rest into an overflow menu (the rule's canonical pattern), which also fixes M2 below.

### H4. API-key form: 12 of 19 permission labels render raw i18n keys

**Rule:** `clarity-deference-depth` · **Viewport:** both · **Page:** `/app/:team/api-keys/new`

Scope checkboxes render literally as `page.apiKeys.form.fields.scopes.options.teams:read`, `…invites:write`, `…team-domains:read`, `…maintenance:read/write`, `…dns-monitors:read/write`, `…tcp-monitors:read/write`, `…status-pages:read/write`, `…api-keys:read/write`. Only the monitors/alerts/cron-jobs scopes are translated. On mobile the long keys clip mid-word at the screen edge, making the permissions unreadable — on a security-sensitive form where users must understand exactly what they grant.

- `apps/r3-uptime/app/http/controllers/app/team/api-key-new.tsx:102` builds the key per scope (verified).
- `apps/r3-uptime/app/locales/en.ts:3346-3354` defines only 7 scope options (verified). All other locales need the same additions.

---

## Medium

### M1. No app page has an `<h1>`; heading hierarchy starts at h2/h3

**Rule:** `typography-and-readable-content` · **Scope:** every app page (reported by all four reviewers)

The page title is a styled `<span>` in the header bar (`apps/r3-uptime/resources/layouts/app-shell.tsx:139` — the comment says it replaces "what used to be each page's own `<h1>`"; rendered at :708). Accessibility trees show zero level-1/2 headings on dashboard, monitors index, and new-monitor pages; screen-reader users get no page outline anywhere in the app. Visually, the title reads at ~0.9375rem — smaller than adjacent content — so nothing is "visually dominant" as a page title either. The docs section, which kept real `h1`s, is the best-structured surface in the app and shows the target state.

### M2. Mobile header: always-visible actions truncate page titles and duplicate on-page CTAs

**Rule:** `responsive-density-and-chrome` · **Viewport:** mobile · **Scope:** every index page with header actions

Titles render as "Ale…", "DNS Monit…", "TCP Monit…", "Maintenance …", "Status Pa…" while header CTAs wrap to two lines beside them. On empty indexes the header CTA duplicates the empty-state CTA immediately below, so the control that destroys the page identity earns no space. (`apps/r3-uptime/resources/layouts/app-shell.tsx:129-148` — fixed 64px header, ellipsized `breadcrumbText`.) Dropping the duplicate CTA or collapsing header actions into an overflow on narrow viewports restores the title.

### M3. Marketing site: primary nav disappears below 768px with no alternative

**Rule:** `navigation-by-device-class` · **Viewport:** mobile · **Page:** `/` (and other marketing pages)

Features/Compare/Pricing/Docs header links are `display: none` below `md` with no hamburger or drawer (`apps/r3-uptime/resources/layouts/marketing.tsx:202-230` — the code comment acknowledges it), and the footer contains none of those links either (verified programmatically). On a phone, Pricing is reachable only via the hero button; Features, Compare, and Docs are unreachable from the homepage.

### M4. Tabs expose `aria-selected=""` instead of `"true"`/`"false"`

**Rule:** `controls-feedback-and-destructive-actions` (state must be perceivable) · **Viewport:** both · **Pages:** dashboard monitor-type tabs

The active tab renders `aria-selected=""` (empty string) and inactive tabs omit the attribute — assistive tech cannot tell which of HTTP/DNS/TCP/Cron Jobs is selected; the state is conveyed only by the underline color. `apps/r3-uptime/resources/components/tabs.tsx:126` (`aria-selected={active}` with a non-boolean-attribute value).

### M5. Check Interval slider has no programmatic label

**Rule:** `touch-pointer-keyboard-targets` · **Viewport:** both · **Pages:** `/monitors/new`, `/monitors/:id/edit`

The `input[type=range][name=interval_seconds]` has no associated label or `aria-label` — keyboard/AT users land on an unnamed slider. Its hit area is also ~6px tall on mobile.

### M6. Alert form: all four channel fieldsets always visible

**Rule:** `clarity-deference-depth` · **Viewport:** both · **Page:** `/alerts/new`

With Channel = Email, the form still shows Email, Webhook, Slack, and Discord settings fieldsets; changing the select toggles nothing (`apps/r3-uptime/resources/views/alerts/form.tsx` — a comment confirms the server ignores non-selected-channel fields). A user can fill Slack fields while Channel=Email and they are silently discarded. Progressive disclosure (show only the selected channel's fieldset) is the expected pattern.

### M7. Maintenance form: recurrence is a hand-typed DSL string

**Rule:** `clarity-deference-depth` · **Viewport:** both · **Page:** `/maintenance/new`

"Recurrence pattern (when recurring)" expects `daily:HH:MM-HH:MM` / `weekly:<day>:HH:MM-HH:MM` / `monthly:<day-of-month>:HH:MM-HH:MM` in UTC as free text. It invites format errors, and the field stays visible and editable while the "Recurring" switch is off (no disclosure or disabled state). Structured controls (frequency select + time pickers) would communicate what will happen.

### M8. Cron form: expert-syntax fields rely on placeholder-only hints

**Rule:** `controls-feedback-and-destructive-actions` · **Viewport:** both · **Page:** `/cron-jobs/new`

"Cron expression" has only the placeholder `0 * * * *` (disappears on typing) and "Timezone" is free text defaulting to "UTC" with no accepted-values hint. The shared `Field` component already supports a `description` helper line (`apps/r3-uptime/resources/components/field.tsx:22`) — neither field uses it (`apps/r3-uptime/resources/views/cron-jobs/form.tsx:81-87, 131-137`).

### M9. Logout confirmation offers no way to decline

**Rule:** `controls-feedback-and-destructive-actions` · **Viewport:** both · **Page:** `/logout`

The page contains exactly an `h1` ("Are you sure you want to logout?") and a single "Logout" submit — no Cancel, no "Back to dashboard" link; the only way out is browser back (`apps/r3-uptime/app/http/controllers/logout.tsx:24-49`). A confirmation step must offer both outcomes. (Also see L15/L16 for presentation and copy.)

### M10. Monitor detail: year heatmap scrolls horizontally with no affordance and misleading edge labels

**Rule:** `gestures-need-visible-alternatives` · **Viewport:** mobile · **Page:** `/monitors/:id`

The 365-cell grid is 1084px wide in a 350px scroll container; only ~Jan–Apr is visible at load, yet the static "Jan 1 … Dec 31" labels span the _visible_ width, so the visible range is mislabeled (the "Dec 31" label sits over April cells). Nothing indicates the grid can be swiped.

### M11. Docs articles: ~88ch monospace measure on desktop

**Rule:** `typography-and-readable-content` · **Viewport:** desktop · **Pages:** `/docs/*`

Paragraphs measure 896px at 17px `ui-monospace` ≈ 88 characters per line, above the 65–75ch guidance; the monospace body compounds the reading cost. A `maxWidth` near `70ch` on the article column fixes it.

### M12. Settings/account dialogs and inputs with noisy or missing accessible names

**Rule:** `clarity-deference-depth` · **Viewport:** both · **Page:** `/app/:team/settings`

The Invite dialog appears in the accessibility tree as an unnamed `dialog` (its visible "Invite Team Member" title is not wired via `aria-labelledby`), and the Logo URL input's accessible name is "Logo URL SX Sergio Xalambrí's Team" because the avatar markup sits inside the label.

### M13. "Slowest Result: 0ms" asserted for a never-checked monitor

**Rule:** `controls-feedback-and-destructive-actions` (honest empty states) · **Viewport:** both · **Page:** `/monitors/:id`

A monitor with Last Checked = "Never" shows "0ms / In the last 24 hours" in the Slowest Result card while sibling cards correctly show "—" and "N/A". 0ms reads as a real measurement; it should show the same no-data treatment.

---

## Low

1. **[navigation-by-device-class]** Sidebar `<nav>` has no `aria-label` (single unlabeled navigation landmark with two unlabeled lists); breadcrumbs are plain `div`s rather than `nav[aria-label="Breadcrumb"]`.
2. **[navigation-by-device-class]** `/alert-history` highlights no sidebar item — the active check is href-prefix based and `alert-history` is a sibling path of `alerts` (`apps/r3-uptime/resources/layouts/app-shell.tsx:502-506`).
3. **[navigation-by-device-class]** Breadcrumb depth is inconsistent: DNS-new shows "DNS Monitors" only while TCP/Cron-new show "Dashboard › …" (`dns-monitor-new.tsx:39-44` vs `tcp-monitor-new.tsx:39-47`); `/monitors/new` has no breadcrumb at all and no Cancel link (edit has both).
4. **[clarity-deference-depth]** Submit-label inconsistency: TCP page heading "Create TCP Monitor" but submit "Create Monitor", while siblings say "Create DNS Monitor"/"Create Cron Job" (`apps/r3-uptime/app/locales/en.ts:1349`).
5. **[clarity-deference-depth]** TCP form uses raw-unit spinbuttons ("Check interval (seconds)" = 300, "Timeout (ms)" = 5000, no range hints) where the DNS form presents the same concept as a human select ("5 minutes").
6. **[clarity-deference-depth]** Status-page form asks for both "Name" and "Title" with nothing distinguishing internal name from public title; boolean options are native checkboxes here but switch toggles on alerts/maintenance forms.
7. **[color-materials-and-motion-preferences]** Heatmap day cells communicate status by color alone — each cell's `title` tooltip carries only the date, and tooltips are unreachable on touch. (The text legend mitigates.)
8. **[controls-feedback-and-destructive-actions]** Monitor edit: mid-page "Save Changes / Cancel" reads page-level but submits only the first of four forms on the page; Cancel is a bare 58×19px text link beside the filled primary.
9. **[clarity-deference-depth]** Monitor edit "Alert Before Expiry" shows a bare "30" — the unit (days, per `ssl_expiry_warning_days`) is never surfaced, on the only field on the form without helper text.
10. **[color-materials-and-motion-preferences]** No `prefers-reduced-motion` guards anywhere (0 usages; e.g. `tabs.tsx:70`, `switch.tsx:70,80`). Motion is modest 150–200ms micro-transitions, so impact is low.
11. **[controls-feedback-and-destructive-actions]** API-key create form has no Cancel/back action — the locale even defines `actions.cancel` (`en.ts:3362`) but it's unused (`api-key-new.tsx:132`).
12. **[touch-pointer-keyboard-targets]** Marketing footer links are 17px tall with 8px gaps (~25px pitch) across a ~40-link footer on mobile.
13. **[touch-pointer-keyboard-targets]** Docs "Open menu" toggle is 32×32 on mobile — the only path to docs navigation.
14. **[clarity-deference-depth]** Docs mobile breadcrumb truncates to cryptic single letters: "d › c… › http monitors".
15. **[clarity-deference-depth]** Logout page is a bare full-width dashed box pinned to the top of an empty viewport — no centering, no brand/app chrome connecting the layer to the app.
16. **[clarity-deference-depth]** Copy nit: "logout" used as a verb ("Are you sure you want to logout?") — HIG-style copy is "log out" / "Sign out".
17. **[typography-and-readable-content]** Helper text at 13px monospace is at the low end for long sentences (the all-monospace system stack is otherwise a deliberate, consistent identity with no external font loading — not a violation).

---

## What the app does well

- **Dark mode** (`color-materials-and-motion-preferences`): systematically themed via `prefers-color-scheme` tokens on every surface all four reviewers checked — app pages, forms, marketing, docs, danger zones, skeletons, badges. No unstyled surfaces or broken contrast found.
- **Empty states** (`controls-feedback-and-destructive-actions`): every empty index explains the state in one line and offers exactly one next action ("No DNS monitors yet — Create a DNS monitor to track DNS record changes."). Textbook.
- **Destructive actions**: Delete Team uses a typed-DELETE confirmation gate in a red-bordered danger zone; monitor delete is red, isolated under "Danger zone", and guarded by a titled `<dialog>` with Cancel/Delete; the row menu lists Delete last, in red, separated from View/Edit.
- **Navigation architecture** (`navigation-by-device-class`): right-shaped split — persistent labeled sidebar with icons, text, and selected state on desktop; hamburger + full-height drawer (native popover, scrim, Escape dismissal, focus return) on mobile; breadcrumbs on deep pages.
- **Forms**: near-universal programmatic labels (verified in accessibility trees), real `fieldset`/`legend` grouping, explicit-verb submits ("Create DNS Monitor", "Schedule Maintenance"), helper text directly under fields, optional fields marked in the label.
- **No gesture/hover traps** (`gestures-need-visible-alternatives`): outside the two table/heatmap scroll findings, no hover-only or gesture-only actions exist; icon-only buttons all carry accessible names.
- **Web-honest UI** (`hig-scope-for-web`): no fake native chrome, system font stack with no external font loading, async dashboard cards show skeleton fallbacks, visible browser-default focus rings.
- **Docs section**: real `h1` + clean heading hierarchy, sticky sidebar with selected state, Escape-dismissable mobile drawer with focus return — the reference implementation for the rest of the app.

## Suggested fix order

1. **`button.tsx` + `app-shell.tsx` touch sizes** (H1) — one `minHeight` bump at the mobile breakpoint in the shared button size mixins, the nav toggle, and `navLink` clears the biggest systemic finding on every page at once.
2. **Header action overflow on mobile** (H3 + M2) — one primary action + overflow menu below `md`; also stop rendering header CTAs that duplicate empty-state CTAs.
3. **API-key scope locale keys** (H4) — add the 12 missing `scopes.options.*` entries to every locale.
4. **Monitors table on mobile** (H2) — stacked rows/cards under `md` with the actions menu visible.
5. **Restore per-page `h1`** (M1) — render the app-shell title as an `h1` (it can keep the exact same styles).
6. **Small a11y patches** (M4, M5, M12) — `aria-selected={active ? "true" : "false"}`, label the interval slider, `aria-labelledby` on the invite dialog, avatar out of the Logo URL label.
7. Form-clarity items (M6–M8, M13, and the Low list) as polish passes per page.

## Coverage

**Reviewed** (mobile 390×844 + desktop 1440×900, dark-mode passes on representative pages): dashboard, monitors index/new/detail/edit, dns index/new, tcp index/new, cron-jobs index/new, alerts index/new, alert-history, maintenance index/new, status-pages index/new, team settings, account, api-keys index/new, home `/`, docs index + article, logout confirmation.

**Not reviewable in this pass** (no data existed and creating it would have mutated state, which was out of bounds): public status page `/status/:slug`, status-page edit, alert edit, dns/tcp/cron detail + edit pages. Also not reviewed: auth/login flow (session was pre-authenticated), checkout, invite-acceptance page.

Screenshot evidence lives in the session scratchpad (`…/scratchpad/hig{a,b,c,d}/*.png`) — temporary files, not preserved with this document; the measurements and file:line references above are the durable evidence.
