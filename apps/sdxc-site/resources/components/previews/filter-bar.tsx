/**
 * Live preview for `FilterBar` with every slot filled: count tabs (one empty), search, status,
 * region and tag facets, the View menu holding sort, density and auto-refresh, the last-updated
 * time as status, and the applied filters as chips with Clear filters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AutoRefresh } from "@sdxc/ui/app/auto-refresh";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { ViewOptions } from "@sdxc/ui/app/view-options";
import { StatusDot } from "@sdxc/ui/status-dot";

/** The page the bar reads its applied values from. */
const URL_NOW = "/examples/monitors?state=active&status=down&status=degraded&region=fra";

/** Every string the bar shows. */
const LABELS: FilterBar.Labels = {
	toolbar: "Filter monitors",
	tabs: "Monitor states",
	filters: "Filters",
	options: "View",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
};

/** The facets a monitors list offers, counted over the active monitors. */
const FACETS: FilterBar.Facet[] = [
	{
		name: "status",
		label: "Status",
		options: [
			{ value: "up", label: "Up", count: 1204, icon: <StatusDot color="success" /> },
			{ value: "degraded", label: "Degraded", count: 7, icon: <StatusDot color="warning" /> },
			{ value: "down", label: "Down", count: 2, icon: <StatusDot color="danger" /> },
		],
	},
	{
		name: "region",
		label: "Region",
		options: [
			{ value: "fra", label: "Frankfurt", count: 410 },
			{ value: "iad", label: "Virginia", count: 512 },
			{ value: "sin", label: "Singapore", count: 291 },
		],
	},
	{
		name: "tag",
		label: "Tags",
		options: [
			{ value: "api", label: "api", count: 88 },
			{ value: "checkout", label: "checkout", count: 12 },
			{ value: "marketing", label: "marketing", count: 31 },
		],
	},
];

/** The auto-refresh control, drawn twice: its intervals in the View menu, its time as status. */
const REFRESH: AutoRefresh.Props = {
	id: "preview-monitors-refresh",
	url: URL_NOW,
	defaultValue: 30,
	options: [
		{ value: 0, label: "Off" },
		{ value: 30, label: "30s" },
		{ value: 60, label: "1m" },
	],
	refreshedAt: new Date("2026-11-01T12:46:00Z"),
	locale: "en-US",
	timeZone: "UTC",
	labels: { trigger: "Auto-refresh", updated: "Updated {time}" },
};

/** The source the page shows, matching the markup below. */
const CODE = `<FilterBar
	id="monitors"
	url={request.url}
	tabs={[
		{ label: "Active", count: 1213, href: "?state=active", current: true },
		{ label: "Paused", count: 41, href: "?state=paused" },
		{ label: "Archived", count: 0, href: "?state=archived" },
	]}
	search={{ label: "Search monitors", placeholder: "Search monitors…" }}
	facets={[
		{ name: "status", label: "Status", options: [
			{ value: "up", label: "Up", count: 1204, icon: <StatusDot color="success" /> },
			{ value: "degraded", label: "Degraded", count: 7, icon: <StatusDot color="warning" /> },
			{ value: "down", label: "Down", count: 2, icon: <StatusDot color="danger" /> },
		] },
		{ name: "region", label: "Region", options: regions },
		{ name: "tag", label: "Tags", options: tags },
	]}
	sort={{ label: "Sort by", defaultValue: "name", options: [
		{ value: "name", label: "Name" },
		{ value: "-checked", label: "Last checked" },
		{ value: "-incidents", label: "Most incidents" },
	] }}
	options={<>
		<ViewOptions id="monitors-view" url={request.url} inline density={density} labels={viewLabels} />
		<AutoRefresh {...refresh} show="choices" />
	</>}
	status={<AutoRefresh {...refresh} show="status" />}
	labels={{
		toolbar: "Filter monitors", tabs: "Monitor states", filters: "Filters", options: "View", apply: "Apply",
		is: "is", isAnyOf: "is any of", clear: "Clear filters",
		remove: (field, values) => \`Remove \${field}: \${values}\`,
	}}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<FilterBar
			id="preview-monitors"
			url={URL_NOW}
			tabs={[
				{ label: "Active", count: 1213, href: "/examples/monitors?state=active", current: true },
				{ label: "Paused", count: 41, href: "/examples/monitors?state=paused" },
				{ label: "Archived", count: 0, href: "/examples/monitors?state=archived" },
			]}
			search={{ label: "Search monitors", placeholder: "Search monitors…" }}
			facets={FACETS}
			sort={{
				label: "Sort by",
				defaultValue: "name",
				options: [
					{ value: "name", label: "Name" },
					{ value: "-checked", label: "Last checked" },
					{ value: "-incidents", label: "Most incidents" },
				],
			}}
			options={
				<>
					<ViewOptions
						id="preview-monitors-view"
						url={URL_NOW}
						inline
						density={{
							defaultValue: "compact",
							options: [
								{ value: "compact", label: "Compact" },
								{ value: "comfortable", label: "Comfortable" },
							],
						}}
						labels={{
							trigger: "Display",
							layout: "Layout",
							grouping: "Grouping",
							ordering: "Ordering",
							density: "Density",
							properties: "Properties",
							apply: "Apply",
							setDefault: "Set as default",
						}}
					/>
					<AutoRefresh {...REFRESH} show="choices" />
				</>
			}
			status={<AutoRefresh {...REFRESH} show="status" />}
			locale="en-US"
			labels={LABELS}
		/>
	),
};
