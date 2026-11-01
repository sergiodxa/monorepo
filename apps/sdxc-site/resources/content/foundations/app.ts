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
		"What @sdxc/ui/app is for, the naming, keyboard and motion rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/app",
	source: "ui/src/app/index.ts",
	intro: [
		"The parts of a signed-in product: charts, tables, lists, trees, split panes, toolbars, menubars, context menus, toasts and file drops.",
		"Each renders working server HTML; mixins add keyboard, drag and resize where the page hydrates.",
	],
	reachFor: [
		"A dashboard, an admin panel or any screen behind a sign-in.",
		"Data a reader scans, sorts, selects or reorders: tables, lists and trees.",
		"Workspace chrome: split panes, toolbars, menubars, context menus and notifications.",
	],
	ideas: [
		{
			title: "Names required",
			body: "`Table`, `Tree`, `GridList`, `Menubar` and the rest warn in development without `aria-label`.",
		},
		{
			title: "Overridable roles",
			body: "Roles are set through `attrs()`, so a page's own `role` wins.",
		},
		{
			title: "Server HTML first",
			body: "`treeKeys`, `gridListKeys` and `menubarKeys` add WAI-ARIA keyboard patterns in the browser only.",
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
			body: "Tree, bar and tooltip transitions stop under `prefers-reduced-motion`.",
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
			title: "Lists, trees, panes and toasts",
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
