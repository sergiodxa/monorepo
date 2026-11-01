/**
 * The Foundations of `@sdxc/ui/app`: what the dashboard and workspace parts are for, the
 * naming, keyboard and motion rules they share, and each variable the namespace reads or
 * declares, with its default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const APP: Foundations = {
	module: "app",
	slug: "app-foundations",
	title: "App foundations",
	summary:
		"What @sdxc/ui/app solves, the rules its parts share for URLs, saving, feedback and keys, and every variable it reads.",
	importPath: "@sdxc/ui/app",
	source: "ui/src/app/index.ts",
	intro: [
		"The screens of a signed-in product: an app shell, page headers, lists with filters and bulk actions, data tables, dashboards, detail sheets and split views, settings, editors, toasts and a keyboard layer.",
		"It solves the parts every app re-builds by hand, and the judgment behind them: a sidebar that remembers its width, a filtered list that is a link, selection that turns pagination into a bulk bar, saving that is quiet until it fails, and states typed by cause.",
		"Each part renders working server HTML. Small islands add what the platform cannot do: ⌘B, j/k, ⌘K, the bulk bar's count, save timings and toasts.",
	],
	reachFor: [
		"A dashboard, an admin panel, a CMS, an inbox or any screen behind a sign-in.",
		"A list people filter, sort, select and act on: FilterBar, Table, SelectionBar.",
		"A record opened beside its list (DetailSheet, SplitView) or on its own page (PageHeader, PropertyList, Timeline).",
		"Settings and editors: SettingsLayout, SettingsSection, SaveBar, SaveStatus, DangerZone, EditorLayout.",
		"Metrics with context: StatCard, Sparkline, StatusStrip, RangePicker, Chart.",
	],
	ideas: [
		{
			title: "State in the URL",
			body: "Filters, sort, view, range and the open record are search params written by GET forms and links, so a view is a link and Back undoes it.",
		},
		{
			title: "Preferences the server renders",
			body: "The sidebar's collapse and a split view's widths live in cookies (`readAppShellCookie`, `readSplitViewLayout`), so the first paint is right.",
		},
		{
			title: "One selection contract",
			body: "Any list that renders `data-selection-item` checkboxes works with `SelectionBar`; `Table.Select` and `Table.SelectAll` render them for you.",
		},
		{
			title: "Saving is a model",
			body: "`SettingsSection` saves `explicit` or `instant`, never both; `SaveStatus` holds Saving… for 1s; `OptimisticToggle` flips at once and admits failure.",
		},
		{
			title: "Feedback by place",
			body: "Inline first, `Banner` for state that needs resolving, `Toasts` last: one region for server flashes and client toasts, three visible, Undo held 8s.",
		},
		{
			title: "Typed states",
			body: "`Empty` has `kind` first-run, no-results, cleared, permission and error; `Skeleton` presets keep the real row and card heights; `aria-busy` dims a refetching table.",
		},
		{
			title: "One keyboard layer",
			body: "`shortcutRegistry()` ranks modal > sheet > page; `data-shortcut` registers keys from HTML; `KeyboardHelp` lists them; `CommandPalette` opens on ⌘K.",
		},
		{
			title: "No copy in the kit",
			body: "Every string a part shows or announces is a `labels` prop, so an app translates them all.",
		},
		{
			title: "Names required",
			body: "`Table`, `Tree`, `GridList`, `Menubar` and the rest warn in development without `aria-label`.",
		},
		{
			title: "Series by slot",
			body: "`color={n}` picks `--ui-chart-<n>`, so a legend always matches its series.",
		},
		{
			title: "Targets",
			body: "Drag handles, resize handles and toast close buttons grow to `--ui-target-size`.",
		},
		{
			title: "Motion",
			body: "The rail peek, toast stack, save status and every transition stop under `prefers-reduced-motion`.",
		},
	],
	roles:
		"Reads every role, brand, neutral, success, warning and danger, for fills, borders and toasts, and the raw scales through the chart slots.",
	variables: [
		{
			title: "Charts",
			lead: "The eight slots are declared in `theme.css`; the rest fall back to the default in the code.",
			variables: [
				{
					name: "--ui-chart-1 … --ui-chart-8",
					default:
						"brand, success, warning, danger and neutral 600, then brand, success and warning 400; one step lighter in dark",
					controls: "The eight categorical series colors; color={n} picks slot n.",
				},
				{
					name: "--ui-chart-line-width",
					default: "2px",
					controls: "Stroke width of a Chart.Line.",
				},
				{
					name: "--ui-chart-area-width",
					default: "2px",
					controls: "Stroke width of a Chart.Area's outline.",
				},
				{
					name: "--ui-chart-area-fill-opacity",
					default: "0.25",
					controls: "Opacity of the fill under a Chart.Area.",
				},
				{
					name: "--ui-chart-point-radius",
					default: "0.1875rem",
					controls: "Radius of every focusable point marker.",
				},
				{
					name: "--ui-chart-tooltip-gap",
					default: "0.5rem",
					controls: "Space between the active point and the tooltip.",
				},
			],
		},
		{
			title: "Shell and page header",
			lead: "Read by `AppShell`, `PageHeader` and every part that sticks under the shell's top bar.",
			variables: [
				{
					name: "--ui-app-sidebar-width",
					default: "16rem",
					controls: "The expanded sidebar column.",
				},
				{ name: "--ui-app-rail-width", default: "3.25rem", controls: "The collapsed icon rail." },
				{
					name: "--ui-app-sheet-width",
					default: "18rem, at most 85vw",
					controls: "The sidebar as a phone sheet.",
				},
				{
					name: "--ui-app-inset-gap",
					default: "0.5rem",
					controls: "Space between the frame's edge and the content card.",
				},
				{
					name: "--ui-app-inset-radius",
					default: "0.75rem",
					controls: "Corners of the content card.",
				},
				{ name: "--ui-app-nav-row-size", default: "2rem", controls: "Height of a nav row." },
				{ name: "--ui-app-header-height", default: "3.5rem", controls: "The shell's top bar." },
				{
					name: "--ui-app-content-padding",
					default: "1rem; 1.5rem from 48rem",
					controls: "Padding of the shell's main region.",
				},
				{
					name: "--ui-app-sticky-top",
					default: "0px; the shell sets it to its header height",
					controls: "Where sticky page headers, table headers and the settings nav stick.",
				},
				{
					name: "--ui-app-gutter",
					default: "set by the shell's main region",
					controls: "Its padding, so a sticky PageHeader can bleed to the card's edges.",
				},
			],
		},
		{
			title: "Lists and tables",
			variables: [
				{
					name: "--ui-table-row-block-size",
					default: "2.5rem compact, 3.5rem comfortable",
					controls: "Row height, set by Table density.",
				},
				{ name: "--ui-table-header-block-size", default: "2.5rem", controls: "Header row height." },
				{
					name: "--ui-table-bg",
					default: "var(--ui-bg, Canvas)",
					controls: "Surface behind the sticky header and pinned cells.",
				},
				{
					name: "--ui-table-id-max-inline-size",
					default: "14ch",
					controls: "Width of a middle-truncated id cell.",
				},
				{
					name: "--ui-table-bar-min-inline-size",
					default: "6rem",
					controls: "Smallest width of an in-cell data bar.",
				},
				{
					name: "--ui-selection-bar-offset",
					default: "1rem",
					controls: "Gap between the floating SelectionBar and the bottom of its scroll box.",
				},
				{ name: "--ui-status-dot-size", default: "0.5rem", controls: "Diameter of a StatusDot." },
			],
		},
		{
			title: "Metrics",
			variables: [
				{
					name: "--ui-stat-value-size",
					default: "1.875rem; 1.5rem ruled",
					controls: "A StatCard's value.",
				},
				{ name: "--ui-stat-card-padding", default: "1.25rem", controls: "A StatCard's padding." },
				{
					name: "--ui-stat-delta-block-size",
					default: "1.375rem",
					controls: "Height of the delta pill.",
				},
				{
					name: "--ui-stat-chart-block-size",
					default: "2.5rem",
					controls: "Height of a StatCard's chart slot.",
				},
				{
					name: "--ui-sparkline-block-size",
					default: "1.5rem",
					controls: "Height of a Sparkline.",
				},
				{ name: "--ui-sparkline-line-width", default: "1.5px", controls: "Its stroke." },
				{
					name: "--ui-sparkline-dot-size, --ui-sparkline-area-opacity",
					default: "0.375rem, 0.16",
					controls: "Its last-point dot and area fill.",
				},
				{
					name: "--ui-status-strip-block-size",
					default: "2rem",
					controls: "Height of a StatusStrip bar.",
				},
				{
					name: "--ui-status-strip-gap",
					default: "2px; 1px under a 30rem container",
					controls: "Gap between its bars.",
				},
				{
					name: "--ui-chart-comparison-color, --ui-chart-comparison-dash",
					default: "neutral muted ink, 4 4",
					controls: "A comparison series.",
				},
				{
					name: "--ui-chart-threshold-width, --ui-chart-threshold-dash",
					default: "1px, 6 4",
					controls: "A Chart.Threshold line.",
				},
				{ name: "--ui-chart-band-opacity", default: "0.1", controls: "Fill of a Chart.Band." },
			],
		},
		{
			title: "Detail, split views, settings and editors",
			variables: [
				{
					name: "--ui-app-detail-sheet-width",
					default: "clamp(28rem, 36cqi, 36rem)",
					controls: "Width of a DetailSheet.",
				},
				{
					name: "--ui-app-detail-sheet-top",
					default: "0px",
					controls: "Offset of a DetailSheet below an app header.",
				},
				{
					name: "--ui-app-list-width",
					default: "20rem",
					controls: "Default width of a SplitView's list pane.",
				},
				{
					name: "--ui-property-list-label-width",
					default: "9rem",
					controls: "A PropertyList's label column.",
				},
				{
					name: "--ui-timeline-icon-box",
					default: "1.5rem",
					controls: "The icon box a Timeline's rail runs through.",
				},
				{
					name: "--ui-settings-nav-width",
					default: "13rem",
					controls: "The SettingsLayout nav column.",
				},
				{
					name: "--ui-settings-measure",
					default: "42rem",
					controls: "The settings content column.",
				},
				{
					name: "--ui-editor-measure",
					default: "42.5rem",
					controls: "An EditorLayout's writing column.",
				},
				{
					name: "--ui-editor-sidebar-width",
					default: "18rem",
					controls: "An EditorLayout's properties sidebar.",
				},
			],
		},
		{
			title: "Feedback and keyboard",
			variables: [
				{
					name: "--ui-toast-peek",
					default: "0.625rem",
					controls: "How far each folded toast peeks out of the stack.",
				},
				{
					name: "--ui-empty-icon-size",
					default: "3rem; 2rem compact",
					controls: "An Empty state's icon well.",
				},
				{
					name: "--ui-skeleton-list-row-block-size",
					default: "3.5rem",
					controls: "A Skeleton.List row.",
				},
				{ name: "--ui-skeleton-shimmer-duration", default: "1.6s", controls: "One shimmer sweep." },
				{
					name: "--ui-app-palette-width",
					default: "40rem, at most the viewport less 1rem",
					controls: "The CommandPalette.",
				},
				{
					name: "--ui-app-palette-top",
					default: "15vh",
					controls: "Gap above the CommandPalette.",
				},
				{
					name: "--ui-app-keyboard-help-width",
					default: "40rem",
					controls: "The KeyboardHelp sheet.",
				},
			],
		},
		{
			title: "Trees, panes and toasts",
			variables: [
				{
					name: "--ui-tree-indent",
					default: "1.25rem",
					controls: "Indent added per level of a `Tree` row.",
				},
				{
					name: "--ui-table-body-intrinsic-size",
					default: "32rem",
					controls: "Height an off-screen Table.Body reserves while its layout is skipped.",
				},
				{
					name: "--ui-grid-list-intrinsic-size",
					default: "32rem",
					controls: "Height off-screen `GridList` rows reserve while their layout is skipped.",
				},
				{
					name: "--ui-skeleton-block-size",
					default: "1rem",
					controls: "Height of a `Skeleton` placeholder.",
				},
				{
					name: "--ui-resizable-handle-size",
					default: "0.75rem",
					controls: "Thickness of the track a Resizable.Handle reserves.",
				},
				{
					name: "--ui-resizable-panel-min-size, --ui-resizable-panel-max-size",
					default: "set by Resizable.Panel from minSize and maxSize (0% and 100%)",
					controls: "Smallest and largest share a pane may take.",
				},
				{ name: "--ui-toast-z", default: "50", controls: "Stacking order of the toast region." },
				{
					name: "--ui-toast-bg",
					default: "set by Toast from color: that role's bg-tint",
					controls: "Fill of a toast, mixed with transparency behind its blur.",
				},
			],
		},
		{
			title: "Shared tokens",
			lead: "Read through `@sdxc/u`'s helpers. `--ui-target-size` and `--ui-spacing` are declared by the themes; radius and shadow fall back to the default an app overrides by declaring the variable.",
			variables: [
				{
					name: "--ui-target-size",
					default: "1.5rem; 2.75rem on a coarse pointer",
					controls: "Smallest pointer target of drag handles, resize handles and a toast's close.",
				},
				{
					name: "--ui-spacing",
					default: "0.25rem",
					controls: "Unit of every numeric gap and padding, and of a leaf tree row's gutter.",
				},
				{ name: "--ui-text-sm", default: "0.875rem", controls: "Size of tree rows." },
				{
					name: "--ui-radius-md, --ui-radius-lg, --ui-radius-full",
					default: "0.375rem, 0.5rem, 9999px",
					controls: "Corners of skeletons and chart tooltips, toasts, and legend swatches.",
				},
				{
					name: "--ui-shadow-md",
					default: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
					controls: "Elevation of a chart tooltip.",
				},
				{
					name: "--ui-shadow-lg",
					default: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
					controls: "Elevation of a toast.",
				},
			],
		},
		{
			title: "Set by the components",
			lead: "Written by a mixin or from a prop and read back by the part itself. Leave them unset.",
			variables: [
				{
					name: "--ui-chart-tooltip-x, --ui-chart-tooltip-y",
					default: "0px, written by chartTooltip()",
					controls: "Where the tooltip sits, from the active point.",
				},
				{
					name: "--ui-resizable-panel-size",
					default: "set from defaultSize; resizeHandle() rewrites it while dragging",
					controls: "A pane's share of the group.",
				},
			],
		},
	],
};

export default APP;
