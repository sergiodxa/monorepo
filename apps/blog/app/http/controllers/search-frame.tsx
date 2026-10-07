/**
 * HTTP action for the search dialog's frame: the search box and the top matches for `?q=`,
 * rendered as a fragment every public page loads into its dialog and the box re-requests as
 * the visitor types. Parsing and ranking stay in the search repository, as on `/search`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, succeeded } from "@sdxc/result";
import { createAction } from "remix/router";

import { SearchViewModel } from "~/app/http/view-models/search";
import { PostSearch } from "~/app/repositories/search";
import { PUBLIC_PAGE, TAGS } from "~/app/services/cache";
import { SearchFrameView } from "~/resources/views/search-frame";
import routes from "~/routes/web";

/** How many matches the dialog lists before pointing at the full page. */
const SUGGESTION_COUNT = 6;

/**
 * Serves the dialog's body. Every state answers 200, a blank box and text that cannot run
 * included, because the fragment lands inside a dialog on whatever page the visitor is on;
 * the reason a query cannot run is shown under the box instead. Each answer is cached like
 * `/search` and kept out of indexes with `X-Robots-Tag`, being a view of listed posts.
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

	let page = await PostSearch.page(ctx.db, {
		query: parsed.data,
		page: 1,
		perPage: SUGGESTION_COUNT,
	});
	succeeded(page, "Searching posts failed");

	let model = SearchViewModel.suggestions({ query: text, parsed: parsed.data, page: page.data });
	return ctx.render(SearchFrameView, model, { headers });
});
