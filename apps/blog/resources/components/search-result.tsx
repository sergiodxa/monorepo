/**
 * One search match drawn as an activity row: the kind's emoji, the title with its matched
 * words marked, a line of the post's text around the first match, and the date. The
 * `/search` page and the search dialog both list matches with it, so the two look alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Highlight } from "@sdxc/ui";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { ActivityRow } from "~/resources/components/activity-row";

/** Renders a result row; the emoji is named for assistive technology, since the kind is news here. */
export function SearchResult(handle: Handle<{ item: SearchViewModel.Item; size?: "sm" | "lg" }>) {
	return () => {
		let { item, size } = handle.props;

		return (
			<ActivityRow
				kind={item.kind}
				kindLabel={item.kindLabel}
				href={item.href}
				date={item.publishedAt}
				size={size}
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
