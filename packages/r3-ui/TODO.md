# TODO

Tracking checklist for the component, mixin, behavior, and animation catalog this package still needs to implement.

## Foundation

- [x] Package skeleton — package.json, tsconfig.json
- [x] src/index.ts + component/animation/behavior/mixin barrels
- [x] theme.css — `--ui-*` semantic variable layer defining color roles for primary/neutral/success/warning/danger
- [x] reset.css — normalized base reset (box-sizing, margins, borders, form controls), layered before `rmx`
- [x] AGENTS.md — layer rules encoded for contributors and agents
- [x] README.md — install, theme contract, layer rules, reset/theme import order
- [ ] Wire src/index.ts exports as each component/mixin/behavior/animation lands

## Components — HTML + CSS only (no mixin)

- [ ] Alert — static styling
- [ ] Badge — static styling
- [ ] Card — static styling
- [ ] Empty — static styling
- [ ] Skeleton — static styling
- [ ] Spinner — static styling
- [ ] Separator — static styling
- [ ] Keyboard — static styling
- [ ] Header — static styling
- [ ] Heading — static styling
- [ ] Text — static styling
- [ ] Section — static styling
- [ ] Group — static styling
- [ ] Toolbar — static styling
- [ ] OverlayArrow — static styling
- [ ] ImagePlaceholder — static styling
- [ ] AspectRatio — static styling
- [ ] Label — native form elements; date/time fields ride `<input type="date|time">`
- [ ] Description — native form elements
- [ ] FieldError — native form elements
- [ ] Form — native form elements
- [ ] TextField — native form elements
- [ ] Input — native form elements
- [ ] TextArea — native form element; auto-grows via `field-sizing`
- [ ] SearchField — native form elements
- [ ] FileTrigger — native form elements
- [ ] DateField — native form element; rides `<input type="date">`
- [ ] TimeField — native form element; rides `<input type="time">`
- [ ] Button — pending/active states server-rendered (aria-current, data attributes)
- [ ] LinkButton — pending/active states server-rendered (aria-current, data attributes)
- [ ] Link — pending/active states server-rendered (aria-current, data attributes)
- [ ] NavLink — pending/active states server-rendered (aria-current, data attributes)
- [ ] Breadcrumbs — pending/active states server-rendered (aria-current, data attributes)
- [ ] Pagination — pending/active states server-rendered (aria-current, data attributes)
- [ ] Checkbox — styled native control
- [ ] CheckboxGroup — styled native control
- [ ] RadioGroup/Radio — styled native control
- [ ] Switch — styled native control
- [ ] Slider (single thumb) — styled native control
- [ ] Meter — styled native control
- [ ] ProgressBar — styled native control
- [ ] Dialog — `<dialog>` + Invoker Commands
- [ ] AlertDialog — `<dialog>` + Invoker Commands
- [ ] Modal — `<dialog>` + Invoker Commands
- [ ] Drawer — `<dialog>` + Invoker Commands
- [ ] Sheet — `<dialog>` + Invoker Commands
- [ ] Confirm — `<dialog>` + Invoker Commands
- [ ] Popover — Popover API / CSS hover + anchor positioning
- [ ] Tooltip — Popover API / CSS hover + anchor positioning
- [ ] HoverCard — Popover API / CSS hover + anchor positioning
- [ ] NavigationMenu — Popover API / CSS hover + anchor positioning
- [ ] Disclosure — `<details>` / `<details name>`
- [ ] Accordion — `<details>` / `<details name>`
- [ ] Select — native `<select>` + customizable-select styling
- [ ] ScrollArea — CSS scrollbars; anchor-positioned indicator
- [ ] SelectionIndicator — CSS scrollbars; anchor-positioned indicator
- [ ] Table (display, sorting, pagination) — sorting/selection via links and forms
- [ ] Tabs (link mode) — server-selected tabs as links
- [ ] ListBox (display mode) — static option list styling

## Components — pure UI + opt-in mixin

- [ ] Menu — no-JS: opens/closes via Popover API, items reachable in Tab order; mixin: `menuKeys()`
- [ ] ContextMenu — no-JS: none, right-click has no HTML equivalent; mixins: `contextMenu(id)`, `menuKeys()`
- [ ] ListBox (interactive selection) — no-JS: static option list, selection via form controls; mixin: `listboxKeys()`
- [ ] ComboBox — no-JS: `<input>` + `<datalist>`; mixin: `comboboxFilter()`
- [ ] Command — no-JS: renders a plain searchable-looking list; mixin: `commandFilter()`
- [ ] Calendar — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [ ] RangeCalendar — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [ ] DatePicker — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [ ] DateRangePicker — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [ ] NumberField (steppers) — no-JS: native `<input type="number">` spinners; mixin: `stepper()`
- [ ] OtpField — no-JS: single `<input inputmode="numeric" autocomplete="one-time-code">`; mixin: `otpSlots()`
- [ ] Form fields (custom client validation) — no-JS: native constraint attributes + browser bubbles, server re-render; mixin: `validate(schema)`
- [ ] Tabs (client mode) — no-JS: link-mode Tabs (server-selected); mixin: `tabKeys()`
- [ ] GridList — no-JS: static list / nested `<details>` rendering; mixins: `gridListKeys()`, `treeKeys()`, `dragReorder()`
- [ ] Tree — no-JS: static list / nested `<details>` rendering; mixins: `gridListKeys()`, `treeKeys()`, `dragReorder()`
- [ ] TagGroup (removal) — no-JS: form-submission variant; mixin: `pressToggle()`
- [ ] ToggleButton — no-JS: form-submission variant; mixin: `pressToggle()`
- [ ] ToggleButtonGroup — no-JS: form-submission variant; mixin: `pressToggle()`
- [ ] Toast — no-JS: server flash messages render as static Alerts; mixin: `dismiss(options)`
- [ ] Slider (multi-thumb) — no-JS: two paired range inputs; mixin: `dualRange()`
- [ ] Carousel (controls) — no-JS: controls hidden, swipe/scroll still works via scroll-snap; mixin: `carouselControls()`
- [ ] SearchField (clear button) — no-JS: clear button hidden, WebKit shows the native cancel control; mixin: `clearField()`
- [ ] DropZone — no-JS: `<input type="file">`; mixins: `dropZone()`, `dragReorder()`
- [ ] DropIndicator — no-JS: `<input type="file">`; mixins: `dropZone()`, `dragReorder()`
- [ ] Resizable — no-JS: fixed default layout; mixin: `resizeHandle(axis)`
- [ ] Avatar — no-JS: fallback rendered beneath the image; mixin: `imageFallback()`
- [ ] Logo — no-JS: fallback rendered beneath the image; mixin: `imageFallback()`
- [ ] SharedElement — no-JS: cross-document `@view-transition` in CSS; mixin: `viewTransition()`
- [ ] Sidebar (collapse persistence) — no-JS: checkbox-driven CSS collapse, mobile drawer is a `<dialog>`; mixin: `persist(key)`

## Special cases

- [ ] Toaster — behavior class (from `behaviors/`) + pure Toast components; consumer's island owns the render loop, not a hydrated library component
- [ ] ColorProvider/useColor — intentionally omitted; color cascading is expressed as [data-color="x"] & descendant selectors in the stylesheet instead

## Mixins — adapters over remix/ui primitives

- [ ] `menuKeys()` — Menu surface; wraps `remix/ui/menu` for the ARIA menu keyboard pattern (roving tabindex, arrow keys, Home/End, typeahead)
- [ ] `listboxKeys()` — ListBox; wraps `remix/ui/listbox` for the ARIA listbox selection model and keyboard interaction
- [ ] `comboboxFilter()` — ComboBox; wraps `remix/ui/combobox` for as-you-type option filtering and active-option management
- [ ] `tabKeys()` — Tabs list; wraps `remix/ui/tabs` for ARIA tabs arrow-key activation for in-page panels

## Mixins — custom

- [ ] `contextMenu(id)` — ContextMenu trigger area; `contextmenu` has no HTML equivalent, opens the surface at the pointer position
- [ ] `commandFilter()` — Command root; hides non-matching pre-rendered items as the user types, toggles the empty state
- [ ] `calendarKeys()` — Calendar grid; Arrow/PageUp/PageDown/Home/End navigation across rendered month cells
- [ ] `rangePreview()` — RangeCalendar grid; hover preview of the pending date range
- [ ] `stepper()` — NumberField group; `stepUp()`/`stepDown()` are JS-only APIs today, adds press-and-hold repeat (retires once step-up/step-down invoker commands ship broadly)
- [ ] `otpSlots()` — OtpField group; focus advance/retreat between slot inputs, splits pasted codes
- [ ] `validate(schema)` — Form fields; runs the shared `remix/data-schema` field schema client-side via the Constraint Validation API (`setCustomValidity()`, intercepted `invalid` events rendered into `FieldError`)
- [ ] `pressToggle()` — ToggleButton; flips `aria-pressed` without a server round-trip
- [ ] `dismiss(options)` — Toast, Alert; auto-dismiss timers with hover pause, dispatches `ui:dismiss`
- [ ] `dualRange()` — Slider group; native `<input type="range">` is single-thumb, clamps paired inputs into an ordered pair
- [ ] `carouselControls()` — Carousel viewport; handles `--ui-prev`/`--ui-next`/`--ui-goto` commands from static invoker buttons via `scrollBy()`, syncs disabled state at scroll edges
- [ ] `clearField()` — SearchField clear button; clears one input without resetting the surrounding form
- [ ] `dropZone()` — DropZone; drag-and-drop events are JS-only, toggles `data-drop-target`, dispatches `ui:drop-files`
- [ ] `dragReorder()` — GridList, Tree; pointer-driven reorder, positions the DropIndicator, dispatches `ui:reorder`
- [ ] `gridListKeys()` — GridList; ARIA grid keyboard interaction
- [ ] `treeKeys()` — Tree; ARIA tree keyboard interaction
- [ ] `resizeHandle(axis)` — Resizable handle; pointer-tracked panel resizing written to a CSS custom property on the group
- [ ] `imageFallback()` — Avatar/Logo image; the image `error` event is the only reliable load-failure signal, flags the host so CSS reveals the fallback
- [ ] `viewTransition()` — SharedElement; same-document transitions require `document.startViewTransition()`
- [ ] `persist(key)` — Sidebar root; handles the `--ui-toggle` command and mirrors collapse state into a cookie so the server renders the next page already collapsed
- [ ] `hotkey(combo)` — Command dialog, any `<dialog>`/popover; global shortcuts (⌘K) have no declarative HTML wiring, shows or toggles the host
- [ ] `themeToggle()` — Theme switch control; flips `.dark`/`.system` on `<html>` and persists the choice in a cookie so the server renders the next page in the right scheme

## Behavior classes

- [ ] `Toaster` — backs Toast / Toast.Region islands; owns toast queue, auto-dismiss timers, pause-on-hover
- [ ] `Announcer` — backs live-region island (Command counts, drag moves, toasts); owns queue of `aria-live` messages
- [ ] `SelectionModel` — backs GridList, Tree, Table row selection; owns selected keys, toggle/range/select-all semantics
- [ ] `FilterModel` — backs `commandFilter()`; owns query, matched option set, active option, movement across matches
- [ ] `CalendarModel` — backs `calendarKeys()`, `rangePreview()`, the picker family; owns focused date, visible month, range anchor and pending preview
- [ ] `DragSession` — backs `dragReorder()`, `dropZone()`, DropIndicator; owns drag source, current target, computed drop position
- [ ] `ResizeSession` — backs `resizeHandle(axis)`; owns active pointer session, min/max constraint solving across the panel group

## Animations

- [ ] `enterExit()` composer — emits the `@starting-style` entry state, base exit state, and `transition` with `transition-behavior: allow-discrete`, keyed off platform state with a `when` option for custom states
- [ ] `fade()`, `zoom()`, `slide({ from })` presets — sugar over `enterExit()`; one animation mixin per host, composing two on one element is a conflict by design
- [ ] `durations`/`easings` motion tokens — shared design-system motion vocabulary; hydrated islands feed the same tokens into `remix/ui/animation`'s `spring`/`tween` configs
- [ ] `spin()`, `pulse()`, `shimmer()` keyframes — back Spinner, Skeleton, and indeterminate ProgressBar
- [ ] `scrollShadow()` — sticky header/toolbar gains a shadow once content scrolls beneath it; Chromium-only, `@supports (animation-timeline: scroll())`-gated
- [ ] `scrollProgress({ axis })` — progress indicator linked to scroll position (Carousel progress, reading progress); Chromium-only, `@supports`-gated
- [ ] `viewReveal(options)` — entry motion as an element scrolls into view; Chromium-only, `@supports`-gated

## Testing & tooling

- [ ] bun:test suite enforcing component-purity (only css/attrs/types imports from remix/ui in src/components/)
- [ ] Behavior class unit tests — construct, call methods, assert state and dispatched events, no DOM
- [ ] Dev-mode contract-check warnings (missing Dialog id, icon-only Button label, Command.Item without value, stripped from production)

## apps/ui-docs

- [ ] Scaffold the documentation app
- [ ] One page per component as it lands: rendered variants beside source, usage guidance, hydration notes for paired mixins
- [ ] axe-core audit wired for every page
- [ ] Screenshot-diff visual regression checks via the agent-browser CLI
