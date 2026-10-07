/**
 * Search-match highlighting shared by the `/search` page and the search dialog: text already
 * split into segments by `@sdxc/search/query`, each matched one drawn as `<mark>`, so both
 * places mark the words a query found the same way and the text stays escaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HighlightSegment } from "@sdxc/search/query";
import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";

/**
 * Renders text split into highlight segments, each match as `<mark>`, so the reader sees
 * which words the query matched while every segment stays a text node.
 */
export function Highlighted(handle: Handle<{ segments: Array<HighlightSegment> }>) {
	return () => (
		<>
			{handle.props.segments.map((part) =>
				part.match ? (
					<mark mix={[bg("brand.tint"), fg("brand.emphasis"), rounded("sm")]}>{part.text}</mark>
				) : (
					part.text
				),
			)}
		</>
	);
}
