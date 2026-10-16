/**
 * `GET /frames/search` — the search dialog's body: the box and the top matches for `?q=`,
 * rendered as a fragment every page's header loads into its dialog and the box re-requests
 * as the reader types. Parsing and ranking are the same `/search` and the MCP tool use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";
import { isFailure } from "sdxc/result";
import { validate } from "sdxc/validate";

import type { SearchKind } from "~/app/services/search-query";

import { SearchFrameQuerySchema } from "~/app/http/validators/search";
import { buildSearchIndex } from "~/app/services/search";
import { matchDocuments, parseSearch } from "~/app/services/search-query";
import { SearchResults } from "~/app/services/search-results";
import { SearchFrameView } from "~/resources/views/search-frame";
import routes from "~/routes/web";

/** How many matches the dialog lists before pointing at the full page. */
const SUGGESTION_COUNT = 8;

/**
 * Serves the dialog's body. Every state answers 200, a blank box and text that cannot run
 * included, because the fragment lands inside a dialog on whatever page the reader is on;
 * the reason a query cannot run is shown under the box instead. The answer streams as it
 * renders, since a page inlines only the first chunk of a frame's body, and carries
 * `X-Robots-Tag` to stay out of indexes.
 *
 * @returns HTML fragment for `GET /frames/search`.
 */
export default createAction(routes.searchFrame, async (ctx) => {
	let text = ctx.url.searchParams.get("q") ?? "";
	let parsed = parseSearch(text);

	let model: SearchResults.Suggestions;
	if (isFailure(parsed)) model = SearchResults.invalid(text, parsed.error);
	else if (parsed.data === null) model = SearchResults.blank();
	else {
		model = SearchResults.suggestions({
			query: text,
			parsed: parsed.data,
			matches: matchDocuments(await buildSearchIndex(), parsed.data),
			kind: await requestedKind(ctx.url),
			limit: SUGGESTION_COUNT,
		});
	}

	return ctx.render(<SearchFrameView model={model} />, {
		headers: { "X-Robots-Tag": "noindex" },
	});
});

/** The tab `?kind=` asks for, or `null` for "All" when it names no kind. */
async function requestedKind(url: URL): Promise<SearchKind | null> {
	let query = await validate(url.searchParams, SearchFrameQuerySchema);
	if (isFailure(query)) return null;
	return query.data.kind ?? null;
}
