/**
 * Live preview for `FilterMenu` as a branch picker: the trigger names the branch being read,
 * and its popover lists branches and tags as two tabs of links with a filter field on top,
 * the default branch tagged and the current one first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GitBranchIcon } from "@sdxc/icons";
import { FilterMenu } from "@sdxc/ui/app/filter-menu";

/** The source the page shows, matching the markup below. */
const CODE = `<FilterMenu
	id="ref-picker"
	mode="navigate"
	tabs
	trigger={<><GitBranchIcon size={16} aria-hidden="true" /> main</>}
	groups={[
		{ label: "Branches", items: branches.map((branch) => ({
			value: branch.name,
			label: branch.name,
			href: \`/acme/delta/tree/\${branch.name}\`,
			badge: branch.isDefault ? "default" : undefined,
			selected: branch.name === current,
		})) },
		{ label: "Tags", items: tags.map((tag) => ({ value: tag, label: tag, href: \`/acme/delta/tree/\${tag}\` })) },
	]}
	filterAction="/acme/delta/branches"
	footer={<a href="/acme/delta/branches">View all branches</a>}
	labels={{
		title: "Switch branches/tags",
		filter: "Find a branch…",
		empty: "Nothing to show",
		more: "{count} more",
		save: "Save",
		tabs: "Ref type",
	}}
/>`;

/** The repository's branches, newest work first. */
const BRANCHES = [
	"main",
	"fix/tokenizer-offsets",
	"feat/incremental-parse",
	"feat/lsp-hover",
	"chore/bump-vite",
	"release/2.4",
	"release/2.3",
	"perf/arena-allocator",
	"docs/grammar-reference",
];

/** The repository's release tags, newest first. */
const TAGS = ["v2.4.1", "v2.4.0", "v2.3.2", "v2.3.1", "v2.3.0", "v2.2.0"];

/** A ref's address in the preview, which returns the reader to this page. */
function refHref(ref: string): string {
	return `/examples/acme/delta/tree/${ref}`;
}

/** What the preview registry reads: the source to show, and the picker to draw. */
export default {
	code: CODE,
	render: () => (
		<FilterMenu
			id="preview-ref-picker"
			mode="navigate"
			tabs
			trigger={
				<>
					<GitBranchIcon size={16} aria-hidden="true" /> main
				</>
			}
			groups={[
				{
					label: "Branches",
					items: BRANCHES.map((branch) => ({
						value: branch,
						label: branch,
						href: refHref(branch),
						badge: branch === "main" ? "default" : undefined,
						selected: branch === "main",
					})),
				},
				{
					label: "Tags",
					items: TAGS.map((tag) => ({ value: tag, label: tag, href: refHref(tag) })),
				},
			]}
			filterAction="/examples/acme/delta/branches"
			footer={<a href="/examples/acme/delta/branches">View all branches</a>}
			labels={{
				title: "Switch branches/tags",
				filter: "Find a branch…",
				empty: "Nothing to show",
				more: "{count} more",
				save: "Save",
				tabs: "Ref type",
			}}
		/>
	),
};
