/**
 * Client island: the search dialog's text box, which turns typing into live results by
 * pointing the frame it is rendered in at the same frame URL for the text so far. Without
 * script it is a plain `q` field of a `GET` form to `/search`, which is what Enter submits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SearchField } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** How long typing must pause before the results follow it. */
export const SEARCH_DEBOUNCE_MS = 200;

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type SearchInputProps = {
	/** The input's id, which the dialog's label names. */
	id: string;
	/** The text the frame was rendered for, which an unedited box starts from. */
	query: string;
	/** The frame endpoint without a query, so the route owns its own address. */
	frameSrc: string;
};

/**
 * The frame URL for a box's text: the bare endpoint for a blank box, so clearing the box
 * returns the frame to the address it was first rendered from.
 */
export function searchFrameSrc(frameSrc: string, text: string): string {
	let query = text.trim();
	if (query === "") return frameSrc;
	return `${frameSrc}?${new URLSearchParams({ q: query })}`;
}

/**
 * The dialog's search box. Each pause in typing reloads the enclosing frame from the URL for
 * the text; the runtime aborts a reload still in flight when the next one starts, so only the
 * newest text's results land, and a failed request leaves the previous results showing. The
 * box keeps its element across reloads, so focus, caret and typed text survive every one.
 */
export const SearchInput = clientEntry(
	"/resources/components/search-input.tsx#SearchInput",
	function SearchInput(handle: Handle<SearchInputProps>) {
		let pending: ReturnType<typeof setTimeout> | undefined;

		handle.signal.addEventListener("abort", () => clearTimeout(pending));

		/** Points the frame at the text's results, unless it already shows them. */
		function follow(text: string): void {
			let src = searchFrameSrc(handle.props.frameSrc, text);
			if (src === handle.frame.src) return;

			handle.frame.src = src;
			handle.frame.reload().catch(() => undefined);
		}

		return () => (
			<SearchField.Input
				id={handle.props.id}
				name="q"
				defaultValue={handle.props.query}
				placeholder="Remix, SQLite, OAuth…"
				autocomplete="off"
				autofocus
				mix={[
					on<HTMLInputElement, "input">("input", (event) => {
						let text = event.currentTarget.value;
						clearTimeout(pending);
						pending = setTimeout(() => follow(text), SEARCH_DEBOUNCE_MS);
					}),
				]}
			/>
		);
	},
);
