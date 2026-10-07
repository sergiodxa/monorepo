/**
 * View for the search dialog's frame, laid out as one panel: the live search box on top,
 * then, under a hairline, the top matches drawn as activity rows with their matched words
 * marked. Rendered as a fragment, inside whichever page's dialog requested it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visuallyHidden } from "@sdxc/u/a11y";
import { borderEdge, fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { m, p, pb, pi } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { SEARCH_RESULTS_ID, SearchBox } from "~/resources/components/search-box";
import { SearchResult } from "~/resources/components/search-result";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";
import routes from "~/routes/web";

/** The dialog's search box id, apart from the `/search` page's own box. */
export const SEARCH_DIALOG_INPUT_ID = "site-search-q";

/**
 * What the status line says. Blank text says nothing; a count is announced but not shown,
 * since the rows and the "See all" link already show it; a message is shown as well.
 */
function statusOf(model: SearchViewModel.Suggestions): string {
	if (model.state === "blank") return "";
	if (model.state === "invalid") return model.message;
	if (model.total === 0) return `No posts match “${model.query}”.`;
	if (model.total === 1) return "1 result";
	if (model.total <= model.items.length) return `${model.total} results`;
	return `Top ${model.items.length} of ${model.total} results`;
}

/**
 * Creates the dialog body renderer. Submitting the form is a plain `GET` to `/search`, so
 * Enter lands on the full results page with or without script, while the box reloads only
 * this frame as the visitor types. The status line is the one live region, present in every
 * state so a change in it is announced, and blank text leaves the panel at its box alone.
 *
 * @returns A view function that renders from a dialog model.
 */
export function SearchFrameView() {
	return ({ model }: { model: SearchViewModel.Suggestions }) => {
		let hasRows = model.state === "results" && model.items.length > 0;
		let status = statusOf(model);

		return (
			<>
				<search>
					<form method="get" action={routes.search.href()}>
						<SearchBox
							id={SEARCH_DIALOG_INPUT_ID}
							query={model.query}
							frameSrc={routes.searchFrame.href()}
							dialogId={SEARCH_DIALOG_ID}
						/>
					</form>
				</search>
				<div id={SEARCH_RESULTS_ID}>
					<p
						role="status"
						mix={
							hasRows || status === ""
								? [visuallyHidden()]
								: [
										m(0),
										pi(4),
										pb(4),
										borderEdge("block-start", { color: "neutral", width: 1 }),
										text("sm"),
										fg("neutral.muted"),
									]
						}
					>
						{status}
					</p>
					{model.state === "results" && model.items.length > 0 ? (
						<div
							mix={[
								grid(),
								gap(3),
								p(4),
								borderEdge("block-start", { color: "neutral", width: 1 }),
							]}
						>
							<ol aria-label="Top matches" mix={[m(0), p(0), listStyle("none"), grid(), gap(3)]}>
								{model.items.map((item) => (
									<SearchResult key={item.href} item={item} size="sm" />
								))}
							</ol>
							<p mix={[m(0), text("sm")]}>
								<Link href={model.seeAll}>
									See all {model.total === 1 ? "1 result" : `${model.total} results`} →
								</Link>
							</p>
						</div>
					) : null}
				</div>
			</>
		);
	};
}
