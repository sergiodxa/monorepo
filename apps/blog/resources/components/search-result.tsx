/**
 * One search match drawn as an activity row: the kind's emoji, the title with its matched
 * words marked, a line of the post's text around the first match, and the date. The
 * `/search` page and the search dialog both list matches with it, so the two look alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { Highlight } from "@sdxc/ui";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { ActivityRow } from "~/resources/components/activity-row";

/** What a result row is given: the match, its size, and its option id inside a listbox. */
interface SearchResultProps {
	item: SearchViewModel.Item;
	size?: "sm" | "lg";
	/**
	 * Makes the row an `option` with this id, tinted while hovered or chosen, so a combobox
	 * can point `aria-activedescendant` at it.
	 */
	optionId?: string;
}

/** Renders a result row; the emoji is named for assistive technology, since the kind is news here. */
export function SearchResult(handle: Handle<SearchResultProps>) {
	return () => {
		let { item, optionId, size } = handle.props;

		return (
			<ActivityRow
				kind={item.kind}
				kindLabel={item.kindLabel}
				href={item.href}
				date={item.publishedAt}
				size={size}
				id={optionId}
				role={optionId ? "option" : undefined}
				aria-selected={optionId ? "false" : undefined}
				mix={
					optionId
						? [
								p(2),
								rounded("md"),
								hover(bg("neutral.bg-tint-hover")),
								when('&[aria-selected="true"]', bg("neutral.bg-tint-hover")),
							]
						: undefined
				}
				description={
					item.excerpt ? (
						<>
							{item.excerpt.truncatedStart ? "… " : null}
							<Highlight segments={item.excerpt.segments} color="neutral" />
							{item.excerpt.truncatedEnd ? " …" : null}
						</>
					) : undefined
				}
			>
				<Highlight segments={item.title} />
			</ActivityRow>
		);
	};
}
