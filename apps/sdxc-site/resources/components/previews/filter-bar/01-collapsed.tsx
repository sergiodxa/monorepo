/**
 * Live example for `FilterBar` in a narrow pane: an issues list beside a detail view, its
 * facets behind one "Filters (n)" popover while the pane is under 32rem, with a search query
 * applied as a chip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { FilterBar } from "@sdxc/ui/app/filter-bar";

/** The source the page shows, matching the markup below. */
const CODE = `<FilterBar
	id="issues"
	url={request.url}
	collapse
	tabs={[{ label: "Open", count: 26, href: "?state=open", current: true }, { label: "Closed", count: 2828, href: "?state=closed" }]}
	facets={[labelsFacet, assigneeFacet]}
	search={{ label: "Search issues", placeholder: "Search…" }}
	labels={labels}
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Facets collapsed behind Filters in a narrow pane",
	code: CODE,
	render: () => (
		<div mix={[is("100%"), maxIs("26rem")]}>
			<FilterBar
				id="preview-issues"
				url="/examples/issues?state=open&label=bug&q=hydration"
				collapse
				tabs={[
					{ label: "Open", count: 26, href: "/examples/issues?state=open", current: true },
					{ label: "Closed", count: 2828, href: "/examples/issues?state=closed" },
				]}
				facets={[
					{
						name: "label",
						label: "Labels",
						options: [
							{ value: "bug", label: "bug", count: 9 },
							{ value: "docs", label: "docs", count: 4 },
							{ value: "good-first-issue", label: "good first issue", count: 3 },
						],
					},
					{
						name: "assignee",
						label: "Assignee",
						options: [
							{ value: "none", label: "Unassigned", count: 17 },
							{ value: "ana", label: "Ana Ruiz", count: 5 },
							{ value: "kenji", label: "Kenji Mori", count: 4 },
						],
					},
				]}
				search={{ label: "Search issues", placeholder: "Search…" }}
				locale="en-US"
				labels={{
					toolbar: "Filter issues",
					tabs: "Issue states",
					filters: "Filters",
					apply: "Apply",
					is: "is",
					isAnyOf: "is any of",
					clear: "Clear filters",
					remove: (field, values) => `Remove ${field}: ${values}`,
				}}
			/>
		</div>
	),
};
