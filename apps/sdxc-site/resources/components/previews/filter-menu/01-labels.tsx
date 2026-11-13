/**
 * Live example for `FilterMenu` as an issue's label picker: checkboxes with each label's
 * colour and a line on what it means, posted together when the popover closes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FilterMenu } from "@sdxc/ui/app/filter-menu";

/** The source the page shows, matching the markup below. */
const CODE = `<FilterMenu
	id="issue-labels"
	mode="multiple"
	name="label"
	action="/acme/delta/issues/231/labels"
	trigger="Labels"
	groups={[{ label: "Labels", items: labels.map((label) => ({
		value: label.id,
		label: label.name,
		description: label.description,
		color: label.color,
		selected: issue.labels.includes(label.id),
	})) }]}
	labels={{
		title: "Apply labels to this issue",
		filter: "Filter labels",
		empty: "No labels match",
		more: "{count} more",
		save: "Save",
	}}
/>`;

/** The repository's labels, with the two this issue carries selected. */
const LABELS: FilterMenu.Item[] = [
	{
		value: "bug",
		label: "bug",
		description: "Something isn't working",
		color: "#d73a4a",
		selected: true,
	},
	{
		value: "parser",
		label: "area: parser",
		description: "Tokenizer, grammar and AST",
		color: "#5319e7",
		selected: true,
	},
	{
		value: "enhancement",
		label: "enhancement",
		description: "New feature or request",
		color: "#a2eeef",
	},
	{
		value: "good-first-issue",
		label: "good first issue",
		description: "Good for newcomers",
		color: "#7057ff",
	},
	{
		value: "needs-triage",
		label: "needs triage",
		description: "Waiting on a maintainer to sort it",
		color: "#fbca04",
	},
	{
		value: "performance",
		label: "performance",
		description: "Slower or heavier than it should be",
		color: "#0e8a16",
	},
	{
		value: "docs",
		label: "documentation",
		description: "Improvements or additions to the docs",
		color: "#0075ca",
	},
	{
		value: "wontfix",
		label: "wontfix",
		description: "This will not be worked on",
		color: "#e4e669",
	},
];

/** What the preview registry reads: the title, the source to show, and the picker to draw. */
export default {
	title: "Labels, several at once",
	code: CODE,
	render: () => (
		<FilterMenu
			id="preview-issue-labels"
			mode="multiple"
			name="label"
			action="/examples/acme/delta/issues/231/labels"
			trigger="Labels"
			groups={[{ label: "Labels", items: LABELS }]}
			labels={{
				title: "Apply labels to this issue",
				filter: "Filter labels",
				empty: "No labels match",
				more: "{count} more",
				save: "Save",
			}}
		/>
	),
};
