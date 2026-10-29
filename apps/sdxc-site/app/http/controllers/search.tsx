/**
 * `GET /search` — every guide and package matching `?q=`, a page at a time. It is where the
 * header's trigger leads without script and where the dialog's "See all" points, so a query
 * typed anywhere on the site has a page of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createPaging } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { buildSearchIndex } from "~/app/services/search";
import { matchDocuments, parseSearch } from "~/app/services/search-query";
import { SearchResults } from "~/app/services/search-results";
import { SearchView } from "~/resources/views/search";
import routes from "~/routes/web";

/** Twenty results a page, up to fifty for a reader who asks with `?perPage=`. */
const PAGING = createPaging({ perPage: 20, maxPerPage: 50 });

/**
 * Serves the search page. A blank box renders the form alone; a query with nothing to search
 * for, or over a limit, answers 400 with the reason beside the field; malformed paging
 * redirects to the query's first page; anything else renders the requested page, clamped to
 *
 * @returns HTML response for `GET /search`.
 */
export default createAction(routes.search, async (ctx) => {
	let text = ctx.url.searchParams.get("q") ?? "";
	let parsed = parseSearch(text);
	let canonical = ctx.url.href;

	if (isFailure(parsed)) {
		let model = SearchResults.invalid(text, parsed.error);
		return ctx.render(<SearchView assets={ctx.assets} model={model} canonical={canonical} />, {
			status: 400,
			headers: { "X-Robots-Tag": "noindex" },
		});
	}

	if (parsed.data === null) {
		let response = ctx.render(
			<SearchView assets={ctx.assets} model={SearchResults.blank()} canonical={canonical} />,
		);
		return await withBundleCache(ctx.request, response, ctx.url.search);
	}

	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) {
		return redirect(`${routes.search.href()}?${new URLSearchParams({ q: text })}`);
	}

	let model = SearchResults.results({
		query: text,
		parsed: parsed.data,
		matches: matchDocuments(await buildSearchIndex(), parsed.data),
		page: params.data.page,
		perPage: params.data.perPage,
		url: ctx.url,
	});
	let response = ctx.render(
		<SearchView assets={ctx.assets} model={model} canonical={canonical} />,
		{
			headers: { "X-Robots-Tag": "noindex" },
		},
	);
	return await withBundleCache(ctx.request, response, ctx.url.search);
});
