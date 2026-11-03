/**
 * Island that finishes a {@link DocsNav} in the browser: the sidebar opens scrolled to the
 * current page, and an optional field filters its pages by title as the reader types. It renders
 * only the field, so the tree it acts on stays server HTML however many pages it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { clientEntry } from "remix/component";

import { SearchField } from "../components/search-field.js";

import { docsNavTools } from "./mixins/docs-nav-tools.js";

/** Prop types for {@link DocsNavTools}. */
export namespace DocsNavTools {
	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		/**
		 * The title filter's accessible name, placeholder, the query parameter it submits as
		 * and the query the page was rendered for; unset draws no field.
		 */
		filter?: { label: string; placeholder: string; name: string; query: string };
	};
}

/**
 * Renders the filter field inside a `GET` form on the current address, so before or without
 * script, Enter reloads the page filtered by the server. `DocsNav` places it; load
 * `@sdxc/ui/docs/docs-nav-tools` in the browser entry to filter as the reader types.
 */
export const DocsNavTools: EntryComponent<DocsNavTools.Props> = clientEntry(
	"@sdxc/ui/docs/docs-nav-tools#DocsNavTools",
	function DocsNavTools(handle: Handle<DocsNavTools.Props>) {
		return () => {
			let { filter } = handle.props;
			return (
				<form method="get" mix={[docsNavTools()]}>
					{filter ? (
						<SearchField aria-label={filter.label}>
							<SearchField.Input
								name={filter.name}
								defaultValue={filter.query}
								placeholder={filter.placeholder}
								autocomplete="off"
							/>
						</SearchField>
					) : null}
				</form>
			);
		};
	},
);
