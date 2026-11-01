/**
 * Live preview for `FilterBar`: a monitors list filtered to the checks that are down or
 * degraded in Frankfurt, with count tabs, status, region and tag facets with per-value counts,
 * search, sort, and the applied filters as chips with Clear filters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { StatusDot } from "@sdxc/ui/status-dot";

/** The page the bar reads its applied values from. */
const URL_NOW = "/examples/monitors?state=active&status=down&status=degraded&region=fra";

/** Every string the bar shows. */
const LABELS: FilterBar.Labels = {
	toolbar: "Filter monitors",
	tabs: "Monitor states",
	filters: "Filters",
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

/** The source the page shows, matching the markup below. */
const CODE = `<FilterBar
	id="monitors"
	url={request.url}
	tabs={[
		{ label: "Active", count: 1213, href: "?state=active", current: true },
		{ label: "Paused", count: 41, href: "?state=paused" },
	]}
	facets={[
		{ name: "status", label: "Status", options: [
			{ value: "up", label: "Up", count: 1204, icon: <StatusDot color="success" /> },
			{ value: "degraded", label: "Degraded", count: 7, icon: <StatusDot color="warning" /> },
			{ value: "down", label: "Down", count: 2, icon: <StatusDot color="danger" /> },
		] },
		{ name: "region", label: "Region", options: regions },
		{ name: "tag", label: "Tags", options: tags },
	]}
	search={{ label: "Search monitors", placeholder: "Search monitors…" }}
	sort={{ label: "Sort by", defaultValue: "name", options: [
		{ value: "name", label: "Name" },
		{ value: "-checked", label: "Last checked" },
		{ value: "-incidents", label: "Most incidents" },
	] }}
	labels={{
		toolbar: "Filter monitors", tabs: "Monitor states", filters: "Filters", apply: "Apply",
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
			]}
			facets={FACETS}
			search={{ label: "Search monitors", placeholder: "Search monitors…" }}
			sort={{
				label: "Sort by",
				defaultValue: "name",
				options: [
					{ value: "name", label: "Name" },
					{ value: "-checked", label: "Last checked" },
					{ value: "-incidents", label: "Most incidents" },
				],
			}}
			locale="en-US"
			labels={LABELS}
		/>
	),
};
