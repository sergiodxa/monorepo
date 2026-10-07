/**
 * View for the search dialog's frame: a `GET` form to `/search` around the live search box,
 * a one-line status the dialog announces politely, and the top matches with their matched
 * words marked. Rendered as a fragment, inside whichever page's dialog requested it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, items } from "@sdxc/u/layout";
import { m, p, pb } from "@sdxc/u/size";
import { tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { Badge, Button, Label, Link, SearchField } from "@sdxc/ui";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { Highlighted } from "~/resources/components/highlighted";
import { SearchInput } from "~/resources/components/search-input";
import routes from "~/routes/web";

/** The dialog's search box id, apart from the `/search` page's own box. */
export const SEARCH_DIALOG_INPUT_ID = "site-search-q";

/** The status line for each state: a hint, the reason text cannot run, or the count. */
function statusOf(model: SearchViewModel.Suggestions): string {
	if (model.state === "blank")
		return "Quote a phrase to match it exactly; a minus leaves a word out.";
	if (model.state === "invalid") return model.message;
	if (model.total === 0) return `No posts match “${model.query}”.`;
	if (model.total === 1) return "1 result";
	if (model.total <= model.items.length) return `${model.total} results`;
	return `Top ${model.items.length} of ${model.total} results`;
}

/** One match: its type, then its highlighted title linking to it, then one line of excerpt. */
function SuggestionRow(handle: Handle<{ item: SearchViewModel.Item }>) {
	return () => {
		let { item } = handle.props;

		return (
			<li mix={[grid(), gap(1), pb(2)]}>
				<div mix={[hstack({ gap: 2, align: "center" }), text("sm")]}>
					<Badge color="neutral" variant="secondary">
						{item.kind}
					</Badge>
					<Link href={item.href} mix={[weight("bold"), truncate()]}>
						<Highlighted segments={item.title} />
					</Link>
				</div>
				{item.excerpt ? (
					<p mix={[m(0), text("sm"), fg("neutral.muted"), truncate()]}>
						{item.excerpt.truncatedStart ? "… " : null}
						<Highlighted segments={item.excerpt.segments} />
						{item.excerpt.truncatedEnd ? " …" : null}
					</p>
				) : null}
			</li>
		);
	};
}

/**
 * Creates the dialog body renderer. Submitting the form is a plain `GET` to `/search`, so
 * Enter lands on the full results page with or without script, while the box inside reloads
 * only this frame as the visitor types. The status line is the one live region, so a screen
 * reader hears the count change rather than every result.
 *
 * @returns A view function that renders from a dialog model.
 */
export function SearchFrameView() {
	return ({ model }: { model: SearchViewModel.Suggestions }) => (
		<div mix={[grid(), gap(4)]}>
			<form method="get" action={routes.search.href()}>
				<SearchField>
					<Label htmlFor={SEARCH_DIALOG_INPUT_ID}>
						Search articles, tutorials and the glossary
					</Label>
					<div mix={[grid(), gridTemplate({ columns: "1fr auto" }), gap(2), items("center")]}>
						<SearchInput
							id={SEARCH_DIALOG_INPUT_ID}
							query={model.query}
							frameSrc={routes.searchFrame.href()}
						/>
						<Button type="submit" color="brand">
							Search
						</Button>
					</div>
				</SearchField>
			</form>
			<p role="status" mix={[m(0), text("sm"), fg("neutral.muted"), tabularNums()]}>
				{statusOf(model)}
			</p>
			{model.state === "results" && model.items.length > 0 ? (
				<>
					<ol aria-label="Top matches" mix={[m(0), p(0), listStyle("none"), grid(), gap(2)]}>
						{model.items.map((item) => (
							<SuggestionRow key={item.href} item={item} />
						))}
					</ol>
					<p mix={[m(0), text("sm")]}>
						<Link href={model.seeAll}>
							See all {model.total === 1 ? "1 result" : `${model.total} results`} →
						</Link>
					</p>
				</>
			) : null}
		</div>
	);
}
