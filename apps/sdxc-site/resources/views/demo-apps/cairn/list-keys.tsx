/**
 * Client island: the keyboard layer of a Cairn issue list. `j` and `k` move between rows with
 * a ring drawn inside the row, Enter or `o` opens the focused issue beside the list, and `x`
 * selects it for the bulk bar. Without script every row's link and checkbox stay reachable by Tab.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { rowNavigation } from "@sdxc/ui/app";
import { clientEntry } from "remix/component";

/** Renders a hidden marker carrying the list's row navigation. */
export const ListKeys: EntryComponent<Record<never, never>> = clientEntry(
	import.meta.url,
	function ListKeys() {
		return () => (
			<span
				mix={[
					hidden(),
					rowNavigation({
						within: '[data-slot="cairn-list"]',
						rows: "li[data-issue]",
						primary: "a[data-issue-link]",
						labels: {
							group: "Issues",
							next: "Next issue",
							previous: "Previous issue",
							open: "Open issue",
							toggle: "Select issue",
							selected: "Issue selected",
							deselected: "Issue deselected",
						},
					}),
				]}
			/>
		);
	},
);
