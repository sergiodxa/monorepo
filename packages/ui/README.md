# @sdxc/ui

Styled, accessible `remix/component` components rendered as server HTML.

## Installation

```bash
npm add @sdxc/ui
```

Components render through `remix`, draw their glyphs from
[`@sdxc/icons`](https://www.npmjs.com/package/@sdxc/icons), and build on
[`@sdxc/u`](https://www.npmjs.com/package/@sdxc/u); all three install alongside this package.

## Usage

### Render a component

Every component takes a `Handle<Props>` and renders through JSX. Props such as `color` become
`data-*` attributes that the component's own `css()` styles key off, so this is static HTML with no
client JavaScript:

```tsx
import type { Handle } from "remix/component";

import { Badge } from "@sdxc/ui";

export function OrderStatus(handle: Handle<{ paid: boolean }>) {
	return () => (
		<Badge color={handle.props.paid ? "success" : "warning"}>
			{handle.props.paid ? "Paid" : "Pending"}
		</Badge>
	);
}
```

The package ships no copy: every visible and accessible string is a prop or child you supply.

### Load the stylesheets

Import the reset and the theme ahead of your own styles, then define the five palette scales
(`brand`, `neutral`, `danger`, `warning`, `success`, each `50` through `950`) the theme derives
every `--ui-*` variable from:

```css
@import "@sdxc/ui/reset.css";
@import "@sdxc/ui/theme.css";

:root {
	--ui-color-brand-50: oklch(0.97 0.02 250);
	--ui-color-brand-500: oklch(0.6 0.18 250);
	--ui-color-brand-950: oklch(0.22 0.08 250);
}
```

`reset.css` declares `@layer base, rmx;`, so component styles always win over it. `theme.css` is light
on `:root`, dark under a `.dark` class on `<html>`, and follows `prefers-color-scheme` under `.system`.

### Open a dialog with a plain button

Overlays ride native `<dialog>`, the Popover API and
[Invoker Commands](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API), so a
trigger is an ordinary button and the page tracks no open state:

```tsx
import { Button, Dialog } from "@sdxc/ui";

<Button commandfor="invite" command="show-modal">
	Invite
</Button>
<Dialog id="invite">
	<Dialog.Header>
		<Dialog.Title>Invite a teammate</Dialog.Title>
	</Dialog.Header>
	<Dialog.Footer>
		<Dialog.Close>Close</Dialog.Close>
	</Dialog.Footer>
</Dialog>;
```

### Add behavior with a mixin

Components never hydrate. Interactivity comes from a mixin applied through `mix` inside your own
`clientEntry` island, often paired with a headless behavior class that holds the state:

```tsx
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

import { Command } from "@sdxc/ui";
import { FilterModel } from "@sdxc/ui/behaviors";
import { commandFilter, commandKeys } from "@sdxc/ui/mixins";

export default clientEntry(
	"/components/search-palette.tsx#default",
	function SearchPalette(handle: Handle<{ pages: Array<{ id: string; title: string }> }>) {
		let model = new FilterModel();

		return () => (
			<Command mix={[commandFilter(model), commandKeys(model)]}>
				<Command.Input placeholder="Search pages" />
				<Command.List>
					{handle.props.pages.map((page) => (
						<Command.Item key={page.id} value={page.title}>
							<a href={`/pages/${page.id}`}>{page.title}</a>
						</Command.Item>
					))}
				</Command.List>
				<Command.Empty>No results</Command.Empty>
			</Command>
		);
	},
);
```

A page that sticks to baseline behavior ships no library JavaScript at all.

## API

| Import                 | Contains                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `@sdxc/ui`             | The general components, usable on any page, and their parts.        |
| `@sdxc/ui/<name>`      | One general component, by its file name: `@sdxc/ui/youtube-embed`.  |
| `@sdxc/ui/landing`     | Landing bands, composition craft and animated visuals.              |
| `@sdxc/ui/docs`        | The docs shell, navigation and content blocks.                      |
| `@sdxc/ui/chat`        | The message log, turns, bubbles, markers and attachments.           |
| `@sdxc/ui/color`       | Colour fields, pickers, sliders, swatches, area and wheel.          |
| `@sdxc/ui/app`         | Dashboard and workspace components: charts, tables, lists, toasts.  |
| `@sdxc/ui/video`       | A video player with chapters, transcript, control bar and settings. |
| `@sdxc/ui/<ns>/<name>` | One namespace component, by its file name: `@sdxc/ui/docs/steps`.   |
| `@sdxc/ui/mixins`      | Opt-in DOM behaviors applied through `mix`.                         |
| `@sdxc/ui/behaviors`   | Headless state classes built on `TypedEventTarget`.                 |
| `@sdxc/ui/animations`  | CSS-only motion factories and the `durations`/`easings` tokens.     |
| `@sdxc/ui/styles`      | Style recipes composed inside a `mix` array.                        |
| `@sdxc/ui/utils`       | Framework-free color, chart, geometry, key and DOM helpers; types.  |
| `@sdxc/ui/reset.css`   | The base reset in `@layer base`.                                    |
| `@sdxc/ui/theme.css`   | The `--ui-*` semantic variables and the `--ui-chart-1`…`8` palette. |

A namespace builds on the general components and never on another namespace, and exports the
mixins, behaviors and styles only its components use; the shared helper subpaths hold the rest.
Every export carries JSDoc, so the editor shows each full signature.

### Component contract

- A component's props type lives on its namespace (`Button.Props`, `Dialog.TitleProps`), and
  compound parts hang off the root (`Dialog.Header`, `Chart.Legend.Item`).
- `color` takes a `SemanticColor`: `"brand"`, `"neutral"`, `"success"`, `"warning"` or `"danger"`.
- `mix` styles the host. A wrapper rendering several elements also takes `parts`, one `mix` per
  named part.
- Every measurement reads `var(--ui-<component>-<property>, <default>)`, plus the shared
  `--ui-radius-*` scale, so one declaration retunes a component.
- Title slots (`Dialog.Title`, `Alert.Title`, `Heading`) render the heading level of the nearest
  `HeadingScope`.
- `prefers-reduced-motion`, `prefers-contrast: more` and `prefers-reduced-transparency` are handled
  by the animations and the theme.
- Small controls reach a pointer target of `--ui-target-size` (24px, 44px on coarse pointers).
- In development, a missing accessible name or id linkage (an icon-only `Button`, a `Dialog` without
  `id`, a `Command.Item` without `value`) logs a `console.warn`.

### Components: forms

- `Form` — a `<form>` taking `issues` from a `parseSafe` result; each field beneath reads its own
  errors by `name`.
- `Label`, `Description`, `FieldError` — a caption, supporting copy for `aria-describedby`, and a
  validation message.
- `Input`, `TextArea` — native text controls; the area grows with `field-sizing: content`.
- `TextField`, `DateField`, `TimeField` — labeled, described, validated wrappers around an input.
- `NumberField`, `OtpField` — a number input with step buttons, and a one-time-code field.
- `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch` — native checked-state controls and their
  groupings.
- `ToggleButton`, `ToggleButtonGroup` — a button carrying `aria-pressed`, and a row or column of
  them.
- `Slider`, `Meter`, `ProgressBar` — a range input with a fill and `<output>`, and styled `<meter>`
  and `<progress>` (indeterminate when `value` is unset).
- `Select`, `ComboBox`, `SearchField` — a native `<select>` with customizable-select styling, a
  text input with a `<datalist>`, and a `<search>` landmark.
- `CharacterCount` — island: a ring and the characters left for a limited field; load
  `@sdxc/ui/character-count`, and check `countCharacters()` on the server.

### Components: overlays and menus

- `Dialog`, `AlertDialog` — modals on `<dialog>`; the alert variant ignores light dismiss.
- `Modal`, `Drawer`, `Sheet` — `Dialog` presets: pop-in, edge-docked, and a fixed side column.
- `DialogDismiss` — island closing its dialog on a backdrop press or a followed link; load `@sdxc/ui/dialog-dismiss` in the browser entry.
- `Confirm` — a complete confirmation dialog; with `form` its confirm button submits a real form.
- `Popover`, `Tooltip`, `HoverCard` — an anchored popover, a label shown on hover or focus of the
  preceding sibling, and a detail panel shown on hover or focus within.
- `Menu`, `NavigationMenu` — popover menus, and a row of navigation panels.
- `Command` — a searchable list of actions with `.Input`, `.List`, `.Item` and `.Empty`.
- `OverlayArrow` — a pointer from a floating surface back to its trigger.

### Components: navigation and lists

- `Button` — `color`, `variant`, `size`, and `isPending` to show a spinner at the same size.
- `CtaGroup` — a wrapping row of actions; its `size` reaches every `Button` and `LinkButton` in it,
  and `stack="phone"` stacks them on a phone.
- `Link`, `NavLink`, `LinkButton` — an inline anchor, a navigation link, and a link styled as a
  button.
- `Tabs` — tabs driven by routing: the `.Tab` pointing at the current page is selected.
- `Breadcrumbs`, `Pagination`, `Sidebar` — a trail of parents, a pager landmark, and an app shell
  rail whose collapse rides a checkbox's `:checked`.
- `Disclosure`, `Accordion` — `<details>` sections, alone or stacked.
- `ListBox` — selectable rows sharing one native grouping name.
- `SelectionIndicator`, `SentinelRow` — a selection marker, and a muted row holding a loading or
  "load more" control.

### Components: feedback

- `Alert` — an inline status panel.
- `Badge`, `TagGroup` — a status pill, and a labeled set of removable pills.
- `Spinner` — a busy indicator.
- `LabelChip` — a label pill in any colour whose text stays readable in both schemes.

### Components: layout and content

- `Card`, `Item`, `Group`, `Section`, `Separator` — panels, rows, groupings and dividers. Prefer
  `Feature` from `@sdxc/ui/landing` over `Card` for landing claim cells.
- `ImagePlaceholder`, `Avatar`, `Logo` — an image with fallback, and its round and rounded-square
  presets.
- `AspectRatio`, `ScrollArea`, `Carousel` — a ratio lock, a scroll region, and a scroll-snap slide
  set.
- `YouTubeEmbed` — a lazy-loaded 16:9 YouTube player (`videoId`, `start?`, `title`) served from
  `www.youtube-nocookie.com`, which the page's `frame-src` has to allow.
- `Text`, `Header`, `Keyboard`, `Typeset` — muted copy, a section label, a `<kbd>`, and typography
  for rendered markup. `Typeset` sets the body at 18px (`docs`), 20px (`reading`) or 15px (`chat`).
- `Highlight` — `{ text, match }` segments rendered with each match in a `<mark>`.
- `HeadingScope`, `Heading` — a heading-depth scope, and the `<h1>`–`<h6>` that reads it.
  `Heading` accepts `size="display" | "chapter"` for landing type recipes.
- `SharedElement` — a host with a stable view-transition name across page loads.
- `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` — month grids for a day or a range,
  and popover pickers around them; `Calendar` without children renders `<input type="date">`.

### Landing (`@sdxc/ui/landing`)

Landing bands, composition craft and animated visuals. Every piece imports from
`@sdxc/ui/landing`, or on its own as `@sdxc/ui/landing/<name>`.

**Bands and primitives**

- `LandingSection` — landing band (`tone` incl. `brand` | `gradient`, `spacing`, `align`, `ruled`, `inset`, `variant="frame"`).
- `LandingHeader` — eyebrow + chapter title + lead (`eyebrowVariant`: `mono` | `quiet` | `soft` | `pill` | `numbered`).
- `Split`, `Split.Copy`, `Split.Media` — two-column band content (`lean`, optional `checks`).
- `StatStrip`, `StatStrip.Item` — numeric proof strip (`ruled` | `gap`).
- `LogoCloud` — adopter marks at `--ui-landing-logo-height` (`layout`: `row` | `spread` | `grid`, `label`, `muted`).
- `Feature`, `Feature.Grid` — claim cells in a grid of cards or a hairline mosaic (`variant`).

**Building blocks**

- `LandingHero` — eyebrow, display title, lead, `CtaGroup`, `note`, `proof`, media (`mediaPlacement`: `below` | `end` | `background`).
- `ProofStrip` — compact ruled band for `LogoCloud` and/or `StatStrip` children.
- `FeatureBand` — header + `layout`: `split` | `grid` | `steps` | `stage` | `timeline`; split `mediaSide` (`start` | `end`) and `lean`.
- `PricingBand`, `PricingBand.Plan` — plan cards; a `featured` plan inverts and leads on phones.
- `TestimonialBand`, `TestimonialBand.Quote` — quote cards in masonry columns.
- `FaqBand` — header + one or two `Accordion` columns (`columns={1|2}`).
- `ClosingCta` — inverse/tinted close with title, lead, and actions.
- `FlowDiagram` — animated run: a `trigger`, `steps` passing along a rail, an `outcome` and `footnote`.
- `SequenceDiagram` — animated exchange: `actors` on lifelines and `messages` travelling between them in order.
- `FanOutDiagram` — animated one-to-many: a `source` reaching every one of its `targets` (`direction="in"` for many-to-one).
- `EventTicker` — animated activity log: `rows` arriving newest first, a status that can flip with `flipTo`.
- `TypedTerminal` — animated terminal: input `lines` typing themselves out, then their output. `variant="code"` plays on the light code card.
- `DrawnChart` — animated figure: a `metric` counting up over a `bars` or `line` `series` that draws in.
- `ScrollScene`, `sceneMotion()` — a pinned stage that plays its parts' keyframes as the reader scrolls, in CSS.
- `CaseStudy` — one client project as a full-bleed scene with the result it earned.
- `ContributorWall` — contributors as square tiles, ending on a tile counting the rest.
- `SponsorWall` — sponsor tiers in ruled grids, then backers; `SponsorWall.Person` takes `showName`.
- `PriceList` — a menu or price list with dotted leaders, in as many columns as fit.
- `Countdown`, `countdownParts` — time left until a moment, server-rendered; `live` ticks it (island `@sdxc/ui/landing/countdown`).
- `EpisodePlayer` — native `<audio>` with chapter and transcript time links (island `@sdxc/ui/landing/episode-player`).
- `UsageEstimate`, `UsageEstimate.Bill` — a GET-form pricing calculator; `live` re-prices a bill frame as the reader types (island `@sdxc/ui/landing/usage-estimate`).

**Composition craft**

- `ProductFrame` — window/device chrome (`stage`, `shadow`, `lights`, `title`, `url`, `footer`), and `designWidth` + `fit` to crop or scale a desktop composition on phones.
- `PhoneFrame`, `screenCorners` — ink phone bezel around a capture or live screen (`bezel`, or `--app-bezel`).
- `PhoneFan` — three phones (`start` / `front` / `end`) fanned on a pausable bobbing stage.
- `CodeStage` / `TerminalPanel` — titled mono panel (`variant`: `code` | `terminal` | `slab`, `language`, `lineNumbers`, `tabs`).
- `InstallTabs`, `InstallTabs.Option` — radio dialect strip (no JS).
- `TabbedStage`, `TabbedStage.Item` — tabs or a vertical rail controlling a media panel (no JS).
- `CheckList`, `CheckRow` — checked claims (`orientation`: `stacked` | `horizontal`).
- `IconWell` — landing glyph tile (`tone`: `quiet` | `brand`; `sm` | `md` | `lg`).
- `Bento`, `Bento.Cell`, `Bento.Media` — cards or a hairline mosaic in equal columns.
- `StepList`, `StepList.Item` — numbered steps or a `timeline`.
- `AnnouncementChip`, `AccentText` — announcement label; marked phrase inside a headline (`color` | `swash` | `highlight`).

### Docs (`@sdxc/ui/docs`)

The docs shell, navigation and content blocks. Islands load as `@sdxc/ui/docs/<name>`; map each
one the page uses in the browser entry.

- `DocsLayout` — docs shell: docked `sidebar` (drawer below `dock`), article `measure`, heading rail from 75rem, sticky bar with menu and `toc`.
- `DocsHub` — docs home routing by task: `search`, `topics` chips, larger `start` cards, `sections` with counts, `popular`.
- `DocsNotFound` — docs 404 body: the missing `path`, a `search` pre-filled by `searchQueryFromPath(path)`, start `links`.
- `Callout` — static docs aside (`kind`: `note` | `tip` | `warning` | `danger`, translated `label`, optional `title`).
- `Steps`, `Steps.Item` — numbered procedure with CSS counters and a rail; each `title` is a heading with an optional `id`.
- `FileTree` — project layout from `nodes`: `<details>` directories, per-type file icons, `highlight` pill, `comment`, `"…"`.
- `UiLabel`, `UiPath` — a product control's name as a sans chip, and a click path of chips joined by `→`.
- `PlanNotice` — the one-sentence plan or role box under a help page's title.
- `CodeBlock` — titled code card: file icon by extension or "Terminal", `highlight`/`add`/`remove` lines, `lineNumbers`, copy without prompts. Tokens read the `--highlight-*` properties of `@sdxc/highlight/styles.css` when the page loads it, and a built-in palette in the page's `color-scheme` otherwise.
- `CodeTabs` — radio tabs over code; `syncKey` switches every set together and `persist` (`cookie` | `local`) remembers it.
- `InstallCommand` — `packages` (and `dev`) spelled for npm, pnpm, yarn and bun in `CodeTabs` synced on `package-manager`.
- `PropsTable` — name/type/default/required/description `rows`; `children` expand in place, rows stack below 36rem.
- `CopyButton`, `CodeTabsSync` — the islands the above hydrate (`@sdxc/ui/docs/copy-button`, `@sdxc/ui/docs/code-tabs-sync`).
- `DocsPageHeader` — breadcrumb, `<h1>`, lead, `notice`, and a meta row with `updated` (a `<time>`) and `actions`.
- `PageActions` — "Copy page" split button over a popover menu of `links`; the copy is the island `@sdxc/ui/docs/page-actions`.
- `AnchorHeading` — heading with an `id`, a `#` link on hover and focus, `--ui-docs-scroll-margin`, a `:target` flash.
- `NextSteps` — hand-written "Next steps" heading plus 2–4 links, as `cards` or a `list`.
- `DocsFeedback` — "Was this helpful?" form posting `helpful`, `page` and `note` without JavaScript; `state="sent"` thanks.
- `DocsPager` — previous/next whole-card links from `findNeighbours(tree, path, { boundary })`.
- `DocsNav` — docs sidebar from a `DocsTree`: current page marked and scrolled into view, `<details>` groups, optional title `filter`, `footer`; island `@sdxc/ui/docs/docs-nav-tools`.
- `TableOfContents` — "On this page" `rail` or sticky `bar`: a marker slides over every section on screen and reaches the last; island `@sdxc/ui/docs/table-of-contents`.
- `DocsTree`, `flattenDocsTree(tree)`, `findNeighbours(tree, path, { boundary: "section" | "none" })` —
  the sidebar's data, walked in reading order by the pager.

| Helper                       | Host                     | Adds                                                                  |
| ---------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `tocSpy()`                   | a `TableOfContents` list | Sections on screen marked, the marker slid over them, the lead named. |
| `docsNavTools()`             | an element in `DocsNav`  | The current page scrolled into view; the title filter.                |
| `codeTabsSync(key, persist)` | an element in `CodeTabs` | Every set sharing `key` switches together; the choice is remembered.  |
| `copyFeedback(copiedLabel)`  | a copy button            | `data-copied` for 2s and the label announced after a copy.            |
| `copyFromUrl(href, failed?)` | a copy button            | Fetches `href` and copies its body; dispatches `ui:copy`.             |

### Chat (`@sdxc/ui/chat`)

- `MessageScroller` — a `role="log"` frame with `.Viewport`, `.Content`, `.Item` and a
  jump-to-latest `.Button`.
- `Message`, `Bubble`, `Marker`, `Attachment` — a turn, its framed content, an inline event between
  turns, and an attached-file card.
- `ScrollFollowModel({ pinned? })` — whether the log follows the live edge, visible messages, and
  pending scroll requests.
- `Activity` — what an assistant did before replying: a "Thinking" disclosure with `.Summary`,
  `.Note`, `.Steps` and `.Step` (an icon, a running state, output it opens onto).
- `Composer` — the message form, with `.Input` (grows to twelve lines), `.Toolbar` and `.Hint`;
  `ComposerSubmit` is its send button, Enter to send, and Stop while a reply streams.
- `revealStream(root)` — replays a server-rendered reply word by word; `streamTarget()` styles it.

| Helper                  | Host                                       | Adds                                                  |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `messageFollow(model)`  | `MessageScroller.Viewport`                 | Follows new turns through a `ScrollFollowModel`.      |
| `attachmentTrigger()`   | `Attachment.Trigger`                       | The whole card as one activation target.              |
| `composerSend(options)` | an element around a composer's send button | Enter to send, clearing, the reply's replay and Stop. |

### Color (`@sdxc/ui/color`)

- `ColorSwatch`, `ColorSwatchPicker` — a color preview, and preset colors as native radios.
- `ColorArea`, `ColorWheel`, `ColorSlider` — saturation/brightness, hue, and single-channel pickers
  built from range inputs.
- `ColorField`, `ColorPicker` — a color text field with a live swatch, and that field with a
  popover (`ColorPicker.Dialog`) hosting any of the pickers above.
- `rtlAwareGradientDirection(propertyName)` and `HUE_GRADIENT_STOPS` — the gradient direction and
  hue stops the sliders and wheel paint.

| Helper             | Host         | Adds                                          |
| ------------------ | ------------ | --------------------------------------------- |
| `colorAreaDrag()`  | `ColorArea`  | A 2D drag across the paired thumbs.           |
| `colorPreview()`   | `ColorField` | The swatch updated as the typed value parses. |
| `colorWheelDrag()` | `ColorWheel` | An angular drag around the ring.              |

### App (`@sdxc/ui/app`)

Dashboard and workspace components.

- `Chart` — an SVG coordinate space (`width`, `height`, `xDomain`, `yDomain`) for `.Line` and
  `.Area` series, plus standalone `.Bar` and `.Pie`, a `.Legend`, and the `.Tooltip` surface that
  `chartTooltip()` drives; every point is a labeled, focusable marker. Its scales and paths are
  `linearScale`, `bandScale`, `ticks`, `linePath`, `areaPath`, `arcPath`, `pieAngles` and
  `computeMarkerIndices`; `chartPalette()` and `legendToggle()` style its series.
- `Table` — a table whose `.Column` takes a sort `href` and whose `.LoadMore` row is a link.
- `GridList`, `Tree` — an interactive row list, and nested `<details>`. `Tree.Leaf` file rows, `Tree.Filter` (with `Tree.NoMatches`) and `Tree.Navigation` make it a file browser.
- `DropIndicator` — the bar marking where a dragged row will land.
- `Toast` — a notification stacked by `Toast.Region`, queued by a `Toaster`.
- `Skeleton`, `Empty` — a loading block, and an empty-state panel; `Skeleton.Text` bars real
  content laid out unseen, so a placeholder wraps like its text.
- `TabBar` — a phone's bottom tab bar that reserves its height and hides where the sidebar shows.
- `Board` — kanban columns of cards, built on the `sortable()` mixin: a drag or Shift+Arrow moves a
  card and posts the card's own move form, which its menu also submits without script.
- `Gantt` — a Gantt chart: grouped projects as bars on a month and week axis, with progress, today's line and a
  hatched tail for a late projection.
- `Toolbar`, `Menubar`, `ContextMenu` — a row of controls, a row of menu triggers, and a
  pointer-positioned menu.
- `PageHeader` — a screen's title row and tabs; tabs that overflow fold into a More menu.
- `CommandPalette` — a ⌘K command list; `CommandPalette.Finder` is a fuzzy file finder page.
- `FilterMenu` — a filterable popover of links, radios or checkboxes, posted as a form on close.
- `CheckRuns`, `MergeBox` — a commit's checks summarised by state, and a merge box that says why it is blocked.
- `ContributionGraph` — a year of daily counts as a grid of cells.
- `CodeView` — a whole file with line links from `?L=`, a line menu and blame (island `@sdxc/ui/app/code-view`).
- `Diff`, `ReviewThread` — a change unified or split with comment links, and a resolvable thread anchored to its lines (island `@sdxc/ui/app/diff`).
- `LogViewer` — a CI job's log by step, with search and timestamps.
- `Resizable` — split panes.
- `ShortcutList` — a `<dl>` pairing actions with key caps.
- `FileTrigger`, `DropZone` — a button opening the file picker, and a drop target, both over a
  native file input.
- `DragSession<Data>()` — the dragged `source`, the `target` under the pointer with its
  `"before" | "after" | "on"` position, and `drop()`.
- `ResizeSession()` — panel sizes during a resize, cascading into neighbors at their limits.
- `SelectionModel({ mode?, keys?, selectedKeys? })` — `toggle`, `selectRange`, `selectAll` over a
  key set.
- `Toaster<Data>({ defaultDuration? })` — `add(data, options?)`, `toasts`, `dismiss(id)`,
  `pause`/`resume`, with each toast's timer owned by the queue.

| Helper                        | Host                  | Adds                                                               |
| ----------------------------- | --------------------- | ------------------------------------------------------------------ |
| `chartTooltip()`              | a chart series        | `Chart.Tooltip` filled from the nearest point to pointer or focus. |
| `contextMenu(id, options?)`   | `ContextMenu.Trigger` | Opens popover `id` at the pointer on right-click or the menu key.  |
| `dragReorder(session)`        | `GridList` / `Tree`   | Pointer reordering through a `DragSession`.                        |
| `dropZone(session)`           | `DropZone`            | File drag-and-drop through a `DragSession`.                        |
| `gridListKeys(model)`         | `GridList`            | The ARIA grid keyboard pattern over a `SelectionModel`.            |
| `menubarKeys(options?)`       | `Menubar`             | The ARIA menubar pattern, handing off into each open `Menu`.       |
| `resizeHandle(axis, session)` | `Resizable.Handle`    | Pointer resizing through a `ResizeSession`.                        |
| `treeKeys(model)`             | `Tree`                | The ARIA tree pattern over a `SelectionModel`.                     |

### Video (`@sdxc/ui/video`)

- `VideoPlayer` — a native `<video>` whose chapters and transcript are written once as data and
  feed its WebVTT tracks, `.Scrubber`, `.Chapters` and `.Transcript`; every time is a `#t=` link
  into the first `.Source`. `.Controls` holds `.Progress`, `.Play`, `.Time`, `.CaptionsToggle`,
  `.Settings`, `.Theater` and `.Fullscreen`, rendered `hidden` behind the native controls until the
  `VideoPlayerSync` island swaps them. `.Settings` takes `.CaptionsMenu`, `.SpeedMenu`,
  `.QualityMenu`, and the page's own `.SettingsToggle` checkboxes and `.SettingsMenu` radio groups,
  which the page reads by `name` from `change` events.

### Component helpers

- `readFormContext(handle): Form.Context | undefined` and
  `resolveFieldIssue(handle, name, errorMessage?): FieldIssueState` — how a custom field joins
  `Form`'s issues.
- `readAmbientLevel(handle)`, `resolveHeadingLevel(handle, level?)` and `TAG_BY_LEVEL` — how a
  custom heading joins `HeadingScope`.
- `tabIndicatorMix(orientation, activeIndex, tabSize)` — positions `Tabs.List`'s sliding indicator
  for fixed-size tabs.

### Mixins

Each mixin module documents why it needs JavaScript and what still works without it.

| Mixin                           | Host                            | Adds                                                                                |
| ------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| `activeDescendantKeys()`        | a combobox input                | Arrows over its `aria-controls` options; Enter follows the chosen link.             |
| `ariaChecked()`                 | checkbox, switch or radio       | `aria-checked` kept in step with the live control.                                  |
| `calendarKeys(model)`           | `Calendar.Grid`                 | Arrow/Page/Home/End navigation over a `CalendarModel`.                              |
| `carouselControls()`            | `Carousel.Viewport`             | `--ui-prev`, `--ui-next` and `--ui-goto` commands.                                  |
| `channelSync()`                 | a `ColorSlider` group           | Sibling channel gradients that follow each other.                                   |
| `clearField()`                  | `SearchField` clear button      | Empties its `commandfor` input.                                                     |
| `comboboxFilter()`              | `ComboBox.Input`                | As-you-type narrowing.                                                              |
| `commandFilter(model)`          | `Command`                       | Items hidden by a `FilterModel` query.                                              |
| `commandKeys(model)`            | `Command`                       | Arrow keys over matches; Enter activates the active item's link/button.             |
| `copyToClipboard()`             | a button                        | Copies the text of its `commandfor` target, minus `data-copy-exclude`.              |
| `dialogDismiss()`               | an element in a `<dialog>`      | Closes the dialog on a backdrop press or a followed link.                           |
| `dismiss(options?)`             | an alert or toast               | Auto-dismiss countdown paused on hover, plus a `--ui-dismiss` command.              |
| `dualRange()`                   | a two-thumb `Slider`            | Thumbs that cannot cross.                                                           |
| `frameRefresh(options)`         | any host in a frame             | Its frame reloaded on a schedule or an event, resting while hidden.                 |
| `frameSubmit(options?)`         | a `<form>` in a frame           | The form posted through its frame, answered in place in one request.                |
| `headingLevelFallback(options)` | an island's `HeadingScope`      | Reports the page's heading depth to `onLevel` once on attach.                       |
| `hotkey(combo)`                 | a `<dialog>`/`[popover]`        | A document-wide shortcut toggling its host.                                         |
| `imageFallback()`               | an `Avatar`/`Logo` image        | Shows the fallback when the image fails, cached images included.                    |
| `invokerFields()`               | an element in a target          | Presets the target's fields from the opening button's `name`/`value`.               |
| `keymap(bindings)`              | any host                        | Page-wide shortcuts that stand down in fields and foreign dialogs.                  |
| `liveFrame(options)`            | a text input in a frame         | The frame reloaded from `src(value)` once typing pauses.                            |
| `listboxKeys()`                 | `ListBox`                       | Arrow, Home/End and typeahead navigation.                                           |
| `longPress(options?)`           | any element                     | Fires after a pointer holds still for `duration`.                                   |
| `menuKeys(options?)`            | `Menu`                          | The ARIA menu pattern: roving focus, arrows, typeahead.                             |
| `mirrorSelectedOption()`        | a `<selectedcontent>`           | Keeps the customizable select's trigger showing the chosen option.                  |
| `otpSlots()`                    | an `OtpField` group             | Focus moving across slots, and pasted codes split.                                  |
| `persist(key)`                  | `Sidebar`                       | The collapsed state saved to a cookie, plus a `--ui-toggle` command.                |
| `pressToggle()`                 | `ToggleButton`                  | Flips `aria-pressed` on click.                                                      |
| `rangePreview(model)`           | `RangeCalendar.Grid`            | Hover and focus preview of the pending range.                                       |
| `sortable(options?)`            | an element in `[data-sortable]` | Drag and Shift+Arrow moves within and between lists, posting each item's move form. |
| `stepper(options?)`             | `NumberField.Group`             | Press-and-hold repeat on the step buttons.                                          |
| `tabKeys(options?)`             | `Tabs.List`                     | Arrow, Home/End tab activation.                                                     |
| `themeToggle(options?)`         | any host                        | `--ui-theme-light`/`-dark`/`-system` commands saved to a cookie.                    |
| `validate(schema)`              | a form control                  | A `remix/data-schema` check through `setCustomValidity()`.                          |
| `viewTransition()`              | a `SharedElement` island        | A View Transition across a same-document reload.                                    |

Helpers for writing your own:

- `whileLive(handle, subscribe)` — returns a function that subscribes to a model, session or frame
  only while the mixin or island is live in a document, aborting on unmount.
- `trackHostNode(handle)` — returns a getter for the mixin's current host node.
- `bindKeymap(document, bindings, { signal, scope? })` — `keymap` without a host, with the same
  stand-down rules as `isClaimedKeystroke(event, scope?)`.
- `chooseOption(combobox, index)` and `chosenOption(combobox)` — set and read the option
  `activeDescendantKeys` has chosen, after a reload replaces the options.
- `prefetchOption(combobox, index, strategy)` — loads an option's link ahead, as
  `activeDescendantKeys({ prefetch })` does for a resting choice, e.g. the top result once it settles.
- `syncAriaChecked(control)` — refreshes `ariaChecked` after a programmatic checked write or reset.
- `colorChannelProperty(channel)` and `getCommandItemId(item, index)` — the custom property and the
  item id `channelSync` and `commandFilter` read.

Mixins that emit DOM events export their `Event` subclass (`DismissEvent`, `LiveFrameEvent`, `ReorderEvent`,
`ThemeChangeEvent`, …), and those that read markup export the `data-*` attribute and command names
they use (`DRAG_REORDER_ROW_ATTRIBUTE`, `SEARCH_FIELD_CLEAR_COMMAND`, …).

### Behavior classes

DOM-free state that dispatches `change`; an island subscribes and re-renders.

- `Announcer({ hold? })` — an `aria-live` queue: `announce(text, priority?)`, `current`, `next()`.
- `CalendarModel({ focusedDate?, min?, max?, isDateDisabled? })` — the focused day, visible month,
  and an in-progress range (`beginRange`, `completeRange`).
- `FilterModel({ options?, query?, match? })` — query, `matches`, and the active match.

### Animations

CSS-only factories keyed off `[open]`/`:popover-open` (or a `when` selector), each collapsing to an
opacity fade under reduced motion.

- `enterExit(options?)` — the composer behind the rest; `exit` sets quieter leaving values.
- `fade(options?)`, `zoom(options?)`, `slide({ from, ... })` — a fade, a fade with scale, and a fade
  with an offset from `"top" | "right" | "bottom" | "left"`.
- `spin()`, `pulse()`, `shimmer()`, `textShimmer()` — continuous motion for busy and loading states.
- `scrollShadow()`, `scrollProgress()`, `scrollFade()`, `viewReveal()` — scroll- and view-timeline
  effects.
- `durations` — `fast` 150, `normal` 200, `slow` 300, `slower` 400 (ms); `easings` — `standard`,
  `decelerate`, `accelerate`, `linear`.

### Styles

Recipes for a `mix` array: `floatingSurface()`, `surfaceInset()`, `hitArea()`, `panelChrome()`,
`semanticColorPanel()`, `interactiveTransition()`, `fieldStackLayout()`, `outputCaptionText()`,
`rangeThumbAppearance(sizeVar, borderWidthVar)`.

Landing recipes (same entry), shared because general components use them too: `landingContainer()`,
`landingSectionSpace("hero" | "normal" | "compact")`,
`landingBandTone("plain" | "tinted" | "grid" | "inverse")`, `displayHeading(1 | 2 | 3)`,
`landingLead()`, `landingHairline()`, `logoCloudMark()`, `landingCtaChrome()`. They read
the `--ui-landing-*` tokens and optional `--ui-font-display` from `theme.css`. Apply
`viewReveal()` from `@sdxc/ui/animations` on band hosts for scroll entry; reduced-motion is
handled there — no separate landing animation system.

### Utilities

- **Color** — `parseColor(input): RGBAColor | null`, `formatHex`, `formatRgb`, `formatHsl`,
  `rgbToHsl`, `hslToRgb`, `rgbToHsv`, `hsvToRgb`, `clampChannel`, `roundChannel`.
- **Geometry** — `normalizedPointerPosition`, `angleFromCenter`, `angleToHue`, `hueToAngle`,
  `resolveFillPercent`, `FULL_TURN_RADIANS`.
- **Keys** — `parseKeyCombo`, `matchesKeyCombo(event, combo)`, `keyComboGlyphs(combo, apple)`,
  `isTypingTarget`, `TYPING_TARGET_SELECTOR`. A combo is spelled once (`"mod+k"`, `"escape"`,
  `"?"`); `mod` is Command on Apple keyboards and Control elsewhere.
- **Fields** — `resolveFieldWiring(id, options)`, `findPairedRangeInputs`.
- **DOM** — `asCommandEvent`, `dispatchChange`, `isNewPrimaryPress`, `isPrintableKey`, `focusItem`,
  `queryItems`, `setRovingTabindex`, `labelFor`, `hasAccessibleText`, `glyphEdges`, `mergeStyle`, `prefersReducedMotion`, `writeCookie(name, value, { maxAgeSeconds?, path? })`,
  `DISABLED_SELECTOR`, `DEFAULT_ICON_ARIA_HIDDEN`, `ONE_YEAR_SECONDS`.
- **Code** — `codeLines(runs)` splits a highlighter's runs into lines, and `fileIcon(path)` picks a file's icon.
- **Accessibility checks** — `warnIfNoAccessibleName(props, children, message)` and
  `warnIfNoAccessibleLabel(props, message)`, development-only warnings.

### Types

`SemanticColor`, `FieldColor`, `AnchorPlacement`, `AriaInvalid`, `AriaInvalidToken`, `CSSStyles`,
`StyleProp`, `StyleDeclarations`, `HeadingLevel`, `FieldIssueState`, `FieldWiring`,
`FieldWiringOptions`, `FieldPartsProps`, `AccessibleNameProps`, `SemanticColorPanelStyle`,
`KeyCombo`, `Point`, `Rect`, `RGBColor`, `RGBAColor`, `HSLColor`, `HSVColor`, and the option
namespaces `LinearScale`, `BandScale`, `ArcPath` and `PieAngles` from `./utils`. Each component,
mixin, behavior and animation also exposes its option types on its own namespace (`Toaster.Init`,
`Dismiss.Options`, `Fade.Options`).

## Pattern: A Validated Form

`Form` hands a failed parse's issues to each field by `name`; the field renders its `FieldError`,
sets `aria-invalid`, and the first invalid one takes focus. Native constraints still block bad
input before any JavaScript runs.

```tsx
import type { Handle } from "remix/component";

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

import { Button, Form, TextField } from "@sdxc/ui";

export let ContactSchema = f.object({
	email: f.field(s.string().pipe(checks.minLength(1), checks.email())),
});

export function ContactPage(handle: Handle<{ issues?: ReadonlyArray<Form.Issue> }>) {
	return () => (
		<Form method="post" issues={handle.props.issues}>
			<TextField label="Email" name="email" type="email" required />
			<Button type="submit">Send</Button>
		</Form>
	);
}

// In the POST handler:
// let result = s.parseSafe(ContactSchema, formData);
// if (!result.success) render <ContactPage issues={result.issues} /> with status 400
```

Pass `errorMessage` to a field for a message the schema does not produce, or apply
`validate(schema)` from `@sdxc/ui/mixins` to check a control in the browser as the user types.

## Pattern: A Confirmed Destructive Action

`Confirm` with `form` wraps its buttons in a real `<form>`, so confirming is an ordinary POST and
cancelling only closes the dialog:

```tsx
import { Button, Confirm } from "@sdxc/ui";

<Button commandfor="revoke-session" command="show-modal" color="danger">
	Revoke session
</Button>
<Confirm
	id="revoke-session"
	title="Revoke this session?"
	description="The device is signed out immediately."
	confirmLabel="Revoke"
	cancelLabel="Cancel"
	color="danger"
	form={{
		action: "/sessions/revoke",
		method: "post",
		fields: <input type="hidden" name="sessionId" value="42" />,
	}}
/>;
```

Render it outside any other `<form>`. Without `form`, the confirm button closes the dialog and your
page decides what confirmation means; for anything else, compose `AlertDialog` and its parts.

## Pattern: A Toast Queue

A `Toaster` owns the queue and each toast's timer; an island subscribes with `whileLive` and
publishes the queue through context so any descendant can add to it:

```tsx
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

import { Toast, Toaster } from "@sdxc/ui/app";
import { whileLive } from "@sdxc/ui/mixins";

export let Toasts = clientEntry("/components/toasts.tsx#Toasts", function Toasts(handle: Handle) {
	let toaster = new Toaster<{ title: string; color?: Toast.Color }>({ defaultDuration: 5000 });

	whileLive(handle, (model: Toaster, signal) =>
		model.addEventListener("change", () => handle.update(), { signal }),
	)(toaster);
	handle.context.set({ toaster });

	return () => (
		<Toast.Region aria-label="Notifications" placement="bottom-end">
			{toaster.toasts.map((toast) => (
				<Toast key={toast.id} color={toast.data.color}>
					<Toast.Content>
						<Toast.Title>{toast.data.title}</Toast.Title>
					</Toast.Content>
				</Toast>
			))}
		</Toast.Region>
	);
});

// Anywhere below it:
// handle.context.get(Toasts).toaster.add({ title: "Saved", color: "success" });
```

## Pattern: Custom Commands From Static Buttons

A `command` starting with `--` reaches its `commandfor` target as a `CommandEvent` with no built-in
behavior, and mixins answer the `--ui-*` ones. The buttons stay server markup anywhere on the page,
outside the island that owns the target; parameters ride the button's `data-*` attributes:

```tsx
import { Button, Carousel } from "@sdxc/ui";
import { carouselControls, themeToggle } from "@sdxc/ui/mixins";

<Carousel aria-label="Product photos">
	<Carousel.Viewport id="photos" mix={carouselControls()}>
		<Carousel.Track>
			<Carousel.Slide>
				<img src="/front.jpg" alt="Front" />
			</Carousel.Slide>
			<Carousel.Slide>
				<img src="/back.jpg" alt="Back" />
			</Carousel.Slide>
		</Carousel.Track>
	</Carousel.Viewport>
	<Carousel.Controls>
		<Carousel.Previous commandfor="photos" aria-label="Previous photo" />
		<Carousel.Next commandfor="photos" aria-label="Next photo" />
	</Carousel.Controls>
</Carousel>
<Button commandfor="photos" command="--ui-goto" data-slide="1">
	Show back
</Button>

<div id="theme" mix={themeToggle()}>
	<Button commandfor="theme" command="--ui-theme-light">Light</Button>
	<Button commandfor="theme" command="--ui-theme-dark">Dark</Button>
	<Button commandfor="theme" command="--ui-theme-system">System</Button>
</div>;
```

`themeToggle` sets `.dark` or `.system` on `<html>` and writes the `ui:theme` cookie, so your server
can render the same class on the next request. `Button` and the invoker parts render
`type="button"` when they carry `command`; a hand-written `<button commandfor>` inside a `<form>`
needs `type="button"` before its `command` attributes, or the platform runs nothing.

## Pattern: Keyboard Shortcuts

`keymap` binds shortcuts on an island's host, a `Modal` lists them with `ShortcutList`, and an
`Announcer` paces what a live region reads:

```tsx
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

import { Button, Modal } from "@sdxc/ui";
import { ShortcutList } from "@sdxc/ui/app";
import { Announcer } from "@sdxc/ui/behaviors";
import { keymap, whileLive } from "@sdxc/ui/mixins";
import { keyComboGlyphs } from "@sdxc/ui/utils";

export default clientEntry(
	"/components/shortcuts.tsx#default",
	function Shortcuts(handle: Handle<{ apple: boolean }>) {
		let announcer = new Announcer({ hold: 1200 });
		whileLive(handle, (model: Announcer, signal) =>
			model.addEventListener("change", () => handle.update(), { signal }),
		)(announcer);

		let save = () => announcer.announce("Saved");
		let openHelp = () => document.querySelector<HTMLDialogElement>("#shortcuts")?.showModal();

		return () => (
			<div mix={keymap({ "mod+s": save, "?": openHelp })}>
				<Button commandfor="shortcuts" command="show-modal">
					Keyboard shortcuts
				</Button>
				<Modal id="shortcuts" aria-label="Keyboard shortcuts">
					<ShortcutList>
						<ShortcutList.Item keys={keyComboGlyphs("mod+s", handle.props.apple)}>
							Save
						</ShortcutList.Item>
						<ShortcutList.Item keys={["?"]}>Show shortcuts</ShortcutList.Item>
					</ShortcutList>
				</Modal>
				<div role="status" aria-live="polite">
					{announcer.current?.text ?? ""}
				</div>
			</div>
		);
	},
);
```

Bindings stand down while the user types in a field, composes with an IME, or works in a dialog
outside the host. `hotkey("mod+k")` on a `<dialog>` or popover is the one-shortcut shorthand.

## Pattern: Restyling A Component

`mix` adds declarations to a component's host, `parts` reaches the inner elements of a wrapper, and
the style recipes and animation factories compose with your own `css()` in one array:

```tsx
import { css } from "remix/component";

import { Card, TextField } from "@sdxc/ui";
import { zoom } from "@sdxc/ui/animations";
import { floatingSurface } from "@sdxc/ui/styles";

<Card mix={css({ maxInlineSize: "32rem" })} style={{ "--ui-radius-lg": "1rem" }}>
	<TextField
		label="Username"
		name="username"
		parts={{ input: css({ fontFamily: "var(--ui-font-mono)" }) }}
	/>
</Card>

<div
	id="account-menu"
	popover="auto"
	mix={[floatingSurface(), zoom({ scale: 0.95 }), css({ paddingBlock: "0.5rem" })]}
>
	Signed in as Ada
</div>;
```

A `@sdxc/u` utility in `mix` overrides the component's own utility for the same property:
`<Text mix={text("xs")}>` renders extra-small text. To change a declaration the component sets
another way, override its `--ui-*` variable (as above), use `style`, or write the rule in a cascade
layer declared after `rmx`. When `parts` is not enough,
compose the underlying pieces (`Label`, `Input`, `Description`, `FieldError`) directly.

## Pattern: A Chart With A Legend

Charts render as accessible SVG on the server: every point is a focusable marker whose `label` is its
native tooltip. A `Chart.Legend` placed after the chart pairs its items with the series by order:

```tsx
import type { Handle } from "remix/component";

import { css } from "remix/component";

import { Chart } from "@sdxc/ui/app";

interface Point {
	x: number;
	y: number;
	label: string;
}

export function RevenueChart(handle: Handle<{ revenue: Point[]; refunds: Point[] }>) {
	return () => (
		<>
			<Chart
				width={480}
				height={240}
				xDomain={[0, 11]}
				yDomain={[0, 5000]}
				aria-label="Revenue by month"
			>
				<Chart.Line color={1} points={handle.props.revenue} />
				<Chart.Line
					color={3}
					points={handle.props.refunds}
					parts={{ path: css({ strokeDasharray: "4 4" }) }}
				/>
			</Chart>
			<Chart.Legend aria-label="Series">
				<Chart.Legend.Item color={1}>Revenue</Chart.Legend.Item>
				<Chart.Legend.Item color={3}>Refunds</Chart.Legend.Item>
			</Chart.Legend>
		</>
	);
}
```

`color` picks one of the eight `--ui-chart-*` colors. `Chart.Area` plots inside a `Chart` the same
way; `Chart.Bar` and `Chart.Pie` are standalone SVGs sized by their own `width` and `height`.

## Pattern: A Message Thread That Follows New Turns

`messageFollow` keeps the log pinned to the newest turn until the reader scrolls away, then reveals
the jump-to-latest button:

```tsx
import type { Handle } from "remix/component";

import { clientEntry, css } from "remix/component";

import { Bubble, Message, MessageScroller, ScrollFollowModel, messageFollow } from "@sdxc/ui/chat";

interface Turn {
	id: string;
	text: string;
	mine: boolean;
}

export default clientEntry(
	"/components/thread.tsx#default",
	function Thread(handle: Handle<{ turns: Turn[] }>) {
		let model = new ScrollFollowModel({ pinned: true });

		return () => (
			<MessageScroller mix={css({ blockSize: "32rem" })}>
				<MessageScroller.Viewport mix={messageFollow(model)}>
					<MessageScroller.Content>
						{handle.props.turns.map((turn) => (
							<MessageScroller.Item key={turn.id} messageId={turn.id}>
								<Message>
									<Message.Content>
										<Bubble align={turn.mine ? "end" : "start"} variant="muted">
											<Bubble.Content>{turn.text}</Bubble.Content>
										</Bubble>
									</Message.Content>
								</Message>
							</MessageScroller.Item>
						))}
					</MessageScroller.Content>
				</MessageScroller.Viewport>
				<MessageScroller.Button aria-label="Jump to latest">Latest</MessageScroller.Button>
			</MessageScroller>
		);
	},
);
```

`messageId` is unique per turn; `scrollAnchor` on an item keeps that turn in place while earlier ones
load above it.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/ui": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
