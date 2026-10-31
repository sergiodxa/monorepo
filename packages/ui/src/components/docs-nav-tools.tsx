/**
 * Island that finishes a {@link DocsNav} in the browser: the sidebar opens scrolled to the
 * current page, and an optional field filters its pages by title. It renders only the field,
 * so the tree it acts on stays server HTML however many pages it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { clientEntry } from "remix/component";

import { docsNavTools } from "../mixins/docs-nav-tools.js";

import { SearchField } from "./search-field.js";

/** Prop types for {@link DocsNavTools}. */
export namespace DocsNavTools {
	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		/** The title filter's accessible name and placeholder; unset draws no field. */
		filter?: { label: string; placeholder: string };
	};
}

/**
 * Renders the filter field, hidden until it loads, inside the nav it enhances. `DocsNav`
 * places it; load `@sdxc/ui/docs-nav-tools` in the browser entry.
 */
export const DocsNavTools: EntryComponent<DocsNavTools.Props> = clientEntry(
	"@sdxc/ui/docs-nav-tools#DocsNavTools",
	function DocsNavTools(handle: Handle<DocsNavTools.Props>) {
		return () => {
			let { filter } = handle.props;
			return (
				<div hidden mix={[docsNavTools()]}>
					{filter ? (
						<SearchField aria-label={filter.label}>
							<SearchField.Input placeholder={filter.placeholder} autocomplete="off" />
						</SearchField>
					) : null}
				</div>
			);
		};
	},
);
