# TODO

Tracking checklist for the component, mixin, behavior, and animation catalog this package still needs to implement.

## Foundation

- [x] Package skeleton — package.json, tsconfig.json
- [x] src/index.ts + component/animation/behavior/mixin barrels
- [x] theme.css — `--ui-*` semantic variable layer defining color roles for primary/neutral/success/warning/danger
- [x] reset.css — normalized base reset (box-sizing, margins, borders, form controls), layered before `rmx`
- [x] AGENTS.md — layer rules encoded for contributors and agents
- [x] README.md — install, theme contract, layer rules, reset/theme import order
- [x] Wire src/index.ts exports as each component/mixin/behavior/animation lands — components/index.ts and mixins/index.ts were each missing several barrel entries for later-landed modules (Chart, the Color\* family, Item, Menubar; `chartTooltip()`, `colorAreaDrag()`, `channelSync()`, `colorPreview()`, `colorWheelDrag()`, `longPress()`, `menubarKeys()`); now wired
- [x] chart-scale.ts / chart-path.ts — pure scale (linear, band, ticks, pie angle allocation) and SVG path-string (line, area, arc) helpers behind the chart components; framework-agnostic, directly unit-testable with no DOM; lives under `src/utils/`
- [x] theme.css — categorical chart color sequence (`--ui-chart-1` through `--ui-chart-8`) for multi-series charts
- [x] color-math.ts — parses/formats hex, rgb, and hsl color strings, converts between color spaces (including hue/saturation/lightness and hue/saturation/value), and clamps/rounds channel values, behind the Color\* component family; framework-agnostic, directly unit-testable with no DOM; lives under `src/utils/`
- [x] has-accessible-text.ts — a `children` tree-walk answering whether a control's visible content resolves to any accessible text, backing the icon-only dev-mode contract check shared by every interactive component that can render icon-only; framework-agnostic, directly unit-testable with no DOM; lives under `src/utils/`, extracted from 11 components that each previously declared their own copy
- [x] src/styles/ — css() mixin factories composed directly in a `mix` array (`floatingSurface()`, `focusRingPrimary()`, `focusRingByColor()`, `panelChrome()`, `graphicHostStyle()`, `outputCaptionText()`, `interactiveTransition()`, `fieldStackLayout()`, `visuallyHiddenInput()`, `chartPalette()`, `legendToggle()`, `semanticColorPanel()`, `rtlAwareGradientDirection()`, `rangeThumbAppearance()`), each calling `css()` itself instead of handing back a plain object for a component to spread; its own barrel and `"./styles"` package export, parallel to `src/animations/`, `src/behaviors/`, and `src/mixins/`
- [x] easings moved directly into `animations/tokens.ts` beside `durations`, retiring `src/utils/easings.ts` and the re-export that used to sit between them
- [x] SentinelRow moved into `src/components/`, backing `ListBox.LoadMoreItem`, `GridList.LoadMoreItem`, and `Tree.LoadMoreItem` as an ordinary sibling component instead of a `src/utils/` export
- [x] trackHostNode moved into `src/mixins/`, backing the host-node lifecycle cache five mixins (`hotkey`, `listbox-keys`, `range-preview`, `resize-handle`, `view-transition`) share, instead of a `src/utils/` export
- [x] `FOCUS_RING_BY_COLOR`'s last stray `src/utils/` copy retired — `Sidebar.Item` now composes the `focusRingByColor()` factory from `src/styles/` like every other consumer

## Components — HTML + CSS only (no mixin)

- [x] Alert — static styling
- [x] Badge — static styling
- [x] Card — static styling
- [x] Empty — static styling
- [x] Skeleton — static styling
- [x] Spinner — static styling
- [x] Separator — static styling
- [x] Keyboard — static styling
- [x] Header — static styling
- [x] Heading — static styling
- [x] HeadingScope — markup + `css()` only, no mixin of its own; establishes the ambient heading level `Heading` and nested scopes read automatically. `Dialog.Title`, `AlertDialog.Title`, `Card.Title`, `Alert.Title`, `Empty.Title`, and `Disclosure.Header` already read this ambient level instead of a hardcoded tag.
- [x] Item — static styling; a standalone content row composing a leading media slot, a title/description content slot, and a trailing actions slot, for a settings row, a notification list, or a file row
- [x] Text — static styling
- [x] Section — static styling
- [x] Group — static styling
- [x] Toolbar — static styling
- [x] OverlayArrow — static styling
- [x] ImagePlaceholder — static styling
- [x] AspectRatio — static styling
- [x] ColorSwatch — static styling; a color preview box rendering its background from a color value prop, checkerboard-backed for translucent values
- [x] Label — native form elements; date/time fields ride `<input type="date|time">`
- [x] Description — native form elements
- [x] FieldError — native form elements
- [x] Form — native form elements
- [x] TextField — native form elements
- [x] Input — native form elements
- [x] TextArea — native form element; auto-grows via `field-sizing`
- [x] SearchField — native form elements
- [x] FileTrigger — native form elements
- [x] DateField — native form element; rides `<input type="date">`
- [x] TimeField — native form element; rides `<input type="time">`
- [x] Button — pending/active states server-rendered (aria-current, data attributes)
- [x] LinkButton — pending/active states server-rendered (aria-current, data attributes)
- [x] Link — pending/active states server-rendered (aria-current, data attributes)
- [x] NavLink — pending/active states server-rendered (aria-current, data attributes)
- [x] Breadcrumbs — pending/active states server-rendered (aria-current, data attributes)
- [x] Pagination — pending/active states server-rendered (aria-current, data attributes)
- [x] Checkbox — styled native control
- [x] CheckboxGroup — styled native control
- [x] RadioGroup/Radio — styled native control
- [x] Switch — styled native control
- [x] Slider (single thumb) — styled native control
- [x] Meter — styled native control
- [x] ProgressBar — styled native control
- [x] Dialog — `<dialog>` + Invoker Commands
- [x] AlertDialog — `<dialog>` + Invoker Commands
- [x] Modal — `<dialog>` + Invoker Commands
- [x] Drawer — `<dialog>` + Invoker Commands
- [x] Sheet — `<dialog>` + Invoker Commands
- [x] Confirm — `<dialog>` + Invoker Commands
- [x] Popover — Popover API / CSS hover + anchor positioning
- [x] Tooltip — Popover API / CSS hover + anchor positioning
- [x] HoverCard — Popover API / CSS hover + anchor positioning
- [x] NavigationMenu — Popover API / CSS hover + anchor positioning
- [x] Disclosure — `<details>` / `<details name>`
- [x] Accordion — `<details>` / `<details name>`
- [x] Select — native `<select>` + customizable-select styling
- [x] ScrollArea — CSS scrollbars; anchor-positioned indicator
- [x] SelectionIndicator — CSS scrollbars; anchor-positioned indicator
- [x] Table (display, sorting, pagination) — sorting/selection via links and forms
- [x] Tabs (link mode) — server-selected tabs as links
- [x] ListBox (display mode) — static option list styling
- [x] Typeset — static styling; typography layer for rendered markdown or HTML content, its type scale sized by three custom properties
- [x] Message — static styling; a conversational row composing an avatar, header, bubble, and footer slot
- [x] Bubble — static styling; the framed message surface nested inside a message row's content slot
- [x] Marker — static styling; an inline status update, system note, or labeled separator between message rows

## Components — pure UI + opt-in mixin

- [x] Menu — no-JS: opens/closes via Popover API, items reachable in Tab order; mixin: `menuKeys()`
- [x] Menubar — no-JS: each top-level trigger is a native `<button>` reachable in Tab order, opening its own Menu surface via the Popover API exactly like a standalone Menu trigger; mixin: `menubarKeys()`
- [x] ContextMenu — no-JS: none, right-click has no HTML equivalent; mixins: `contextMenu(id)`, `menuKeys()`
- [x] ListBox (interactive selection) — no-JS: static option list, selection via form controls; mixin: `listboxKeys()`
- [x] ComboBox — no-JS: `<input>` + `<datalist>`; mixin: `comboboxFilter()`
- [x] Command — no-JS: renders a plain searchable-looking list; mixin: `commandFilter()`
- [x] Calendar — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [x] RangeCalendar — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [x] DatePicker — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [x] DateRangePicker — no-JS: native `<input type="date">` fallback; mixins: `calendarKeys()`, `rangePreview()`
- [x] NumberField (steppers) — no-JS: native `<input type="number">` spinners; mixin: `stepper()`
- [x] OtpField — no-JS: single `<input inputmode="numeric" autocomplete="one-time-code">`; mixin: `otpSlots()`
- [x] Form fields (custom client validation) — no-JS: native constraint attributes + browser bubbles, server re-render; mixin: `validate(schema)`
- [x] Tabs (client mode) — no-JS: link-mode Tabs (server-selected); mixin: `tabKeys()`
- [x] GridList — no-JS: static list / nested `<details>` rendering; mixins: `gridListKeys()`, `treeKeys()`, `dragReorder()`
- [x] Tree — no-JS: static list / nested `<details>` rendering; mixins: `gridListKeys()`, `treeKeys()`, `dragReorder()`
- [x] TagGroup (removal) — no-JS: form-submission variant; mixin: `pressToggle()`
- [x] ToggleButton — no-JS: form-submission variant; mixin: `pressToggle()`
- [x] ToggleButtonGroup — no-JS: form-submission variant; mixin: `pressToggle()`
- [x] Toast — no-JS: server flash messages render as static Alerts; mixin: `dismiss(options)`
- [x] Slider (multi-thumb) — no-JS: two paired range inputs; mixin: `dualRange()`
- [x] Carousel (controls) — no-JS: controls hidden, swipe/scroll still works via scroll-snap; mixin: `carouselControls()`
- [x] SearchField (clear button) — no-JS: clear button hidden, WebKit shows the native cancel control; mixin: `clearField()`
- [x] DropZone — no-JS: `<input type="file">`; mixins: `dropZone()`, `dragReorder()`
- [x] DropIndicator — no-JS: `<input type="file">`; mixins: `dropZone()`, `dragReorder()`
- [x] Resizable — no-JS: fixed default layout; mixin: `resizeHandle(axis)`
- [x] Avatar — no-JS: fallback rendered beneath the image; mixin: `imageFallback()`
- [x] Logo — no-JS: fallback rendered beneath the image; mixin: `imageFallback()`
- [x] SharedElement — no-JS: cross-document `@view-transition` in CSS; mixin: `viewTransition()`
- [x] Sidebar (collapse persistence) — no-JS: checkbox-driven CSS collapse, mobile drawer is a `<dialog>`; mixin: `persist(key)`
- [x] Chart.Bar, Chart.Line, Chart.Area, Chart.Pie — no-JS: plain computed SVG with a native `<title>` per point/segment, giving every point a hover tooltip and an accessible name reachable by keyboard focus; mixin: `chartTooltip()`
- [x] Chart.Legend — no-JS: series swatches and names render fully readable; series visibility toggles via checkbox-driven CSS, no mixin of its own
- [x] Chart.Tooltip — no-JS: not rendered as part of the baseline chart; a richer, positioned, multi-value tooltip surface the `chartTooltip()` mixin drives
- [x] Attachment — no-JS: a static, already-settled file or image card, fully readable; mixin: `attachmentTrigger()`
- [x] MessageScroller — no-JS: every message row renders in document order and scrolls with native behavior; mixin: `messageFollow()`
- [x] ColorField — no-JS: native `<input>` with a `pattern` constraint for the chosen color format, paired with a swatch preview rendered from the field's own value at render time; mixin: `colorPreview()`
- [x] ColorSwatchPicker — no-JS: native `<input type="radio">` swatches in a fieldset; selection works with zero JavaScript, no mixin of its own
- [x] ColorSlider — no-JS: native `<input type="range">` per channel, with sibling-dependent track gradients computed from custom properties set at render time; mixin: `channelSync()`
- [x] ColorArea — no-JS: two paired native range inputs, one per axis, overlaid on the same rectangle; mixin: `colorAreaDrag()`
- [x] ColorWheel — no-JS: a single native `<input type="range">` for hue, styled linearly; mixin: `colorWheelDrag()`
- [x] ColorPicker — no-JS: falls back to ColorField's own plain field; composes a swatch trigger and a Popover housing ColorArea/ColorWheel/ColorSlider/ColorField/ColorSwatchPicker

## Special cases

- [x] Toaster — behavior class (from `behaviors/`) + pure Toast components; consumer's island owns the render loop, not a hydrated library component
- [x] ColorProvider/useColor — intentionally omitted; color cascading is expressed as [data-color="x"] & descendant selectors in the stylesheet instead
- [x] Direction/useDirection — intentionally omitted; RTL/LTR is achieved natively via the `dir` attribute and logical properties throughout, no JS provider needed

## Mixins — adapters over remix/ui primitives

- [x] `listboxKeys()` — ListBox; wraps `remix/ui/listbox` for the ARIA listbox selection model and keyboard interaction
- [x] `comboboxFilter()` — ComboBox; wraps `remix/ui/combobox` for as-you-type option filtering and active-option management
- [x] `tabKeys()` — Tabs list; wraps `remix/ui/tabs` for ARIA tabs arrow-key activation for in-page panels

## Mixins — custom

- [x] `menuKeys()` — Menu surface; ARIA menu keyboard pattern (roving tabindex, arrow keys, Home/End, typeahead) — a self-contained adapter over Menu's own `data-*`/`role` markup, not a wrapper around `remix/ui/menu`'s composed primitive
- [x] `menubarKeys()` — Menubar row; ARIA menubar roving-tabindex/arrow-key pattern (Left/Right across top-level triggers, Home/End, typeahead), opening and moving the focused trigger's own Menu
- [x] `chartTooltip()` — Chart root; pointer-tracked nearest-point lookup and positioned tooltip content, since no CSS selector computes interpolated placement or dynamic per-point text
- [x] `contextMenu(id)` — ContextMenu trigger area; `contextmenu` has no HTML equivalent, opens the surface at the pointer position
- [x] `commandFilter()` — Command root; hides non-matching pre-rendered items as the user types, toggles the empty state
- [x] `calendarKeys()` — Calendar grid; Arrow/PageUp/PageDown/Home/End navigation across rendered month cells
- [x] `rangePreview()` — RangeCalendar grid; hover preview of the pending date range
- [x] `stepper()` — NumberField group; `stepUp()`/`stepDown()` are JS-only APIs today, adds press-and-hold repeat (retires once step-up/step-down invoker commands ship broadly)
- [x] `otpSlots()` — OtpField group; focus advance/retreat between slot inputs, splits pasted codes
- [x] `validate(schema)` — Form fields; runs the shared `remix/data-schema` field schema client-side via the Constraint Validation API (`setCustomValidity()`, intercepted `invalid` events rendered into `FieldError`)
- [x] `pressToggle()` — ToggleButton; flips `aria-pressed` without a server round-trip
- [x] `ariaChecked()` — Switch, Checkbox, RadioGroup.Radio; opt-in `aria-checked`, rendered as the token matching the host's own initial state and rewritten from the live control on every `change`, refreshing a radio's whole group since a sibling loses its checkedness with no event of its own
- [x] `dismiss(options)` — Toast, Alert; auto-dismiss timers with hover pause, dispatches `ui:dismiss`
- [x] `dualRange()` — Slider group; native `<input type="range">` is single-thumb, clamps paired inputs into an ordered pair
- [x] `carouselControls()` — Carousel viewport; handles `--ui-prev`/`--ui-next`/`--ui-goto` commands from static invoker buttons via `scrollBy()`, syncs disabled state at scroll edges
- [x] `clearField()` — SearchField clear button; clears one input without resetting the surrounding form
- [x] `dropZone()` — DropZone; drag-and-drop events are JS-only, toggles `data-drop-target`, dispatches `ui:drop-files`
- [x] `dragReorder()` — GridList, Tree; pointer-driven reorder, positions the DropIndicator, dispatches `ui:reorder`
- [x] `gridListKeys()` — GridList; ARIA grid keyboard interaction
- [x] `treeKeys()` — Tree; ARIA tree keyboard interaction
- [x] `resizeHandle(axis)` — Resizable handle; pointer-tracked panel resizing written to a CSS custom property on the group
- [x] `imageFallback()` — Avatar/Logo image; the image `error` event is the only reliable load-failure signal, flags the host so CSS reveals the fallback
- [x] `viewTransition()` — SharedElement; same-document transitions require `document.startViewTransition()`
- [x] `persist(key)` — Sidebar root; handles the `--ui-toggle` command and mirrors collapse state into a cookie so the server renders the next page already collapsed
- [x] `hotkey(combo)` — Command dialog, any `<dialog>`/popover; global shortcuts (⌘K) have no declarative HTML wiring, shows or toggles the host
- [x] `themeToggle()` — Theme switch control; flips `.dark`/`.system` on `<html>` and persists the choice in a cookie so the server renders the next page in the right scheme
- [x] `messageFollow()` — MessageScroller viewport; native scroll/wheel/touch/keyboard listening is the only way to detect a reader scrolling away, anchor a new turn near the top with a peek of prior content, and hold the reader's position as older history prepends above them
- [x] `attachmentTrigger()` — Attachment card; telling a click on an action button apart from a click on the rest of the card needs script
- [x] `copyToClipboard()` — Message footer action button; writing to the clipboard is a script-only API
- [x] `colorPreview()` — ColorField host; live-updates the paired swatch preview as the user types, since no CSS selector can read an in-progress input value
- [x] `channelSync()` — wrapping host around sibling ColorSlider instances; keeps every other channel's track gradient in sync while one channel's native range input is being dragged
- [x] `colorAreaDrag()` — ColorArea root; maps a pointer's continuous 2D position to two paired native range inputs, moving both together as one gesture
- [x] `colorWheelDrag()` — ColorWheel root; maps a pointer's angle around a center point to the underlying hue input's value, and reshapes the track from a linear bar into a ring
- [x] `longPress()` — any host element; dispatches a namespaced event after a configurable hold duration, the touch/mobile equivalent of `contextMenu()`
- [x] `headingLevelFallback()` — an island's outermost `HeadingScope`/`Heading` root; recovers an ambient heading level from a `data-heading-level` DOM ancestor for an independently hydrated island whose root wasn't threaded a `level` prop explicitly

## Behavior classes

- [x] `Toaster` — backs Toast / Toast.Region islands; owns toast queue, auto-dismiss timers, pause-on-hover
- [x] `Announcer` — backs live-region island (Command counts, drag moves, toasts); owns queue of `aria-live` messages
- [x] `SelectionModel` — backs GridList, Tree, Table row selection; owns selected keys, toggle/range/select-all semantics
- [x] `FilterModel` — backs `commandFilter()`; owns query, matched option set, active option, movement across matches
- [x] `CalendarModel` — backs `calendarKeys()`, `rangePreview()`, the picker family; owns focused date, visible month, range anchor and pending preview
- [x] `DragSession` — backs `dragReorder()`, `dropZone()`, DropIndicator; owns drag source, current target, computed drop position
- [x] `ResizeSession` — backs `resizeHandle(axis)`; owns active pointer session, min/max constraint solving across the panel group
- [x] `ScrollFollowModel` — backs `messageFollow()`; owns pinned/auto-follow state, the current anchor turn, visible message ids, and which scrollable edges are still reachable

## Animations

- [x] `enterExit()` composer — emits the `@starting-style` entry state, base exit state, and `transition` with `transition-behavior: allow-discrete`, keyed off platform state with a `when` option for custom states
- [x] `fade()`, `zoom()`, `slide({ from })` presets — sugar over `enterExit()`; one animation mixin per host, composing two on one element is a conflict by design
- [x] `durations`/`easings` motion tokens — shared design-system motion vocabulary; hydrated islands feed the same tokens into `remix/ui/animation`'s `spring`/`tween` configs
- [x] `spin()`, `pulse()`, `shimmer()` keyframes — back Spinner, Skeleton, and indeterminate ProgressBar
- [x] `scrollShadow()` — sticky header/toolbar gains a shadow once content scrolls beneath it; Chromium-only, `@supports (animation-timeline: scroll())`-gated
- [x] `scrollProgress({ axis })` — progress indicator linked to scroll position (Carousel progress, reading progress); Chromium-only, `@supports`-gated
- [x] `viewReveal(options)` — entry motion as an element scrolls into view; Chromium-only, `@supports`-gated
- [x] `textShimmer()` — sweeping highlight through text glyphs via `background-clip: text`, for a streaming response caption such as "Generating response…"
- [x] `scrollFade({ axis })` — fades a scroll container's edges via a scroll-linked mask-image gradient, hinting at more content beyond MessageScroller's viewport or any other scrollable region

## Testing & tooling

- [x] bun:test suite enforcing component-purity (only css/attrs/types imports from remix/ui in src/components/)
- [x] Behavior class unit tests — construct, call methods, assert state and dispatched events, no DOM
- [x] Dev-mode contract-check warnings (missing Dialog id, icon-only Button label, Command.Item without value, stripped from production)

## apps/ui-docs

- [ ] Scaffold the documentation app
- [ ] One page per component as it lands: rendered variants beside source, usage guidance, hydration notes for paired mixins
- [ ] axe-core audit wired for every page
- [ ] Screenshot-diff visual regression checks via the agent-browser CLI
