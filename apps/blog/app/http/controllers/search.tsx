/**
 * HTTP action for the public `/search` page. Parsing, ranking and paging stay in the
 * search repository and `@sdxc/pagination`, so the controller picks which state to render
 * and writes the page's `Link` and `X-Total-Count` headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createPaging } from "@sdxc/pagination";
import { isFailure, succeeded } from "@sdxc/result";
import { createAction } from "remix/router";

import { SearchViewModel } from "~/app/http/view-models/search";
import { PostSearch } from "~/app/repositories/search";
import { PUBLIC_PAGE, TAGS } from "~/app/services/cache";
import { SearchView } from "~/resources/views/search";
import routes from "~/routes/web";

/** Ten results a page, up to fifty for a reader who asks with `?perPage=`. */
const PAGING = createPaging({ perPage: 10, maxPerPage: 50 });

/**
 * Serves the search page. A blank box renders the form alone; a query with nothing to
 * search for, or over a limit, answers 400 with the reason beside the field; malformed
 * paging redirects to the query's first page; anything else renders the requested page,
 * clamped to the last one. Previews never appear, whoever is signed in.
 *
 * @returns HTML response for `GET /search`.
 */
export default createAction(routes.search, async (ctx) => {
	let text = ctx.url.searchParams.get("q") ?? "";
	let parsed = PostSearch.parse(text);

	if (isFailure(parsed)) {
		return ctx.render(SearchView, SearchViewModel.invalid(text, parsed.error), { status: 400 });
	}

	if (parsed.data === null) {
		ctx.cache(PUBLIC_PAGE, TAGS.postList());
		return ctx.render(SearchView, SearchViewModel.blank());
	}

	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) {
		let first = new URLSearchParams({ q: text });
		return redirect(`${routes.search.href()}?${first}`);
	}

	let page = await PostSearch.page(ctx.db, {
		query: parsed.data,
		page: params.data.page,
		perPage: params.data.perPage,
	});
	succeeded(page, "Searching posts failed");

	let headers = PAGING.paginate(new Headers(), page.data, { url: ctx.url });
	ctx.cache(PUBLIC_PAGE, TAGS.postList());

	let model = SearchViewModel.results({
		query: text,
		parsed: parsed.data,
		page: page.data,
		url: ctx.url,
	});
	return ctx.render(SearchView, model, { headers });
});
