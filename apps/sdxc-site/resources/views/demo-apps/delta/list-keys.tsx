/**
 * Client island: the keyboard layer of an issue or pull request list. `j` and `k` walk the
 * rows with an inset ring, Enter or `o` opens the focused one, `x` selects it for the bulk bar,
 * and `/` focuses the query field. Without script every row is still a link and a checkbox.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { rowNavigation } from "@sdxc/ui/app";
import { clientEntry } from "remix/component";

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type ListKeysProps = {
	/** The list the rows sit in, as a selector the marker finds among its ancestors. */
	within: string;
	/** The id of the query field `/` focuses. */
	search: string;
	/** The help sheet's words for each key. */
	labels: {
		group: string;
		next: string;
		previous: string;
		open: string;
		toggle: string;
		selected: string;
		deselected: string;
		search: string;
	};
};

/** Renders a hidden marker carrying the list's row navigation. */
export const ListKeys: EntryComponent<ListKeysProps> = clientEntry(
	import.meta.url,
	function ListKeys(handle) {
		return () => (
			<span
				mix={[
					hidden(),
					rowNavigation({
						within: handle.props.within,
						rows: "li[data-row]",
						primary: "a[data-row-link]",
						search: handle.props.search,
						labels: handle.props.labels,
					}),
				]}
			/>
		);
	},
);
