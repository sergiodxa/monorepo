/**
 * HTTP action for the search dialog's frame: the search box and the top matches for `?q=`,
 * rendered as a fragment every public page loads into its dialog and the box re-requests as
 * the visitor types. Parsing and ranking stay in the search repository, as on `/search`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, succeeded } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import type { Kind } from "~/app/models/kinds";

import { SearchFrameQuerySchema } from "~/app/http/validators/search";
import { SearchViewModel } from "~/app/http/view-models/search";
import { PUBLIC_PAGE, TAGS } from "~/app/initializers/cache";
import { PostSearch } from "~/app/models/search";
import { SearchFrameView } from "~/resources/views/search-frame";
import routes from "~/routes/web";

/** How many matches the dialog lists before pointing at the full page. */
const SUGGESTION_COUNT = 6;

/**
 * Serves the dialog's body. Every state answers 200, a blank box and text that cannot run
 * included, because the fragment lands inside a dialog on whatever page the visitor is on;
 * the reason a query cannot run is shown under the box instead.
 *
 * @returns HTML fragment for `GET /frames/search`.
 */
export default createAction(routes.searchFrame, async (ctx) => {
	let text = ctx.url.searchParams.get("q") ?? "";
	let parsed = PostSearch.parse(text);
	let headers = new Headers({ "X-Robots-Tag": "noindex" });
	ctx.cache(PUBLIC_PAGE, TAGS.postList());

	if (isFailure(parsed)) {
		return ctx.render(SearchFrameView, SearchViewModel.invalid(text, parsed.error), { headers });
	}

	if (parsed.data === null) {
		return ctx.render(SearchFrameView, SearchViewModel.blank(), { headers });
	}

	let counts = await PostSearch.counts(ctx.db, parsed.data);
	let kind = await requestedKind(ctx.url, counts);
	let total =
		kind === null ? Object.values(counts).reduce((all, count) => all + count, 0) : counts[kind];

	let page = await PostSearch.page(ctx.db, {
		query: parsed.data,
		page: 1,
		perPage: SUGGESTION_COUNT,
		kind: kind ?? undefined,
		total,
	});
	succeeded(page, "Searching posts failed");

	let model = SearchViewModel.suggestions({
		query: text,
		parsed: parsed.data,
		page: page.data,
		kind,
		counts,
	});
	return ctx.render(SearchFrameView, model, { headers });
});

/**
 * The tab `?kind=` asks for, or `null` for "All" when it names no kind or one with nothing
 * matching, so a tab that empties as the reader types falls back to every match.
 */
async function requestedKind(url: URL, counts: Record<Kind, number>): Promise<Kind | null> {
	let query = await validate(url.searchParams, SearchFrameQuerySchema);
	if (isFailure(query) || query.data.kind === undefined) return null;
	return counts[query.data.kind] > 0 ? query.data.kind : null;
}
