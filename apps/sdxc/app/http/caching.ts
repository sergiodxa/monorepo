/**
 * The cache policy a documentation page answers with. Every input to such a page is
 * a file in the deployed bundle plus the option groups the reader picked, so the page
 * changes when a deploy changes it or when the reader switches: worth storing in the
 * browser, worth storing at the edge for readers who have picked nothing, and worth
 * validating against the bytes actually rendered, which is what lets a deploy that
 * changed nothing on this page cost a reader nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { conditional, etag, policy, vary } from "@sdxc/http/cache";
import { isSuccess } from "@sdxc/result";

import { readOptionSelections } from "~/app/http/cookies";
import { serializeOptionSelections } from "~/app/services/option-groups";

/** How long a browser reuses its own copy before revalidating against the tag. */
const CLIENT_MAX_AGE = "5 minutes";

/**
 * How long a shared cache may serve a stored copy without asking. A deploy is what
 * changes a page and nothing purges the edge, so this is the longest window a page
 * one deploy behind is acceptable for.
 */
const SHARED_MAX_AGE = "1 hour";

/**
 * Gives a rendered page its cache policy and its validator, and answers a client
 * whose copy is still current with a `304` carrying no body.
 *
 * The validator names the build and the page rather than the rendered bytes: every input
 * to a page ships inside the bundle, so one build is one version of every page, while the
 * markup carries a hydration marker the framework regenerates per request that would
 * otherwise retire the reader's copy on every visit.
 *
 * @param request - The incoming request, carrying the reader's validators.
 * @param response - The rendered page.
 * @param variant - What else the page was rendered from, for the parts of it that come
 * from outside the bundle. Naming it here is what retires a reader's copy when one of
 * those moves between deploys.
 * @returns The page with its policy and validator, or a `304`.
 */
/**
 * Names the build every page was rendered from. The bundler stamps it in; a runner that
 * evaluates this module without that step, such as the test environment, gets a constant.
 * The dev server stamps `null`: its code changes under one process, so no name covers it.
 */
function buildId(): string | null {
	return typeof __BUILD_ID__ === "undefined" ? "development" : __BUILD_ID__;
}

export async function withBundleCache(
	request: Request,
	response: Response,
	variant = "",
): Promise<Response> {
	let body = await response.text();

	let headers = new Headers(response.headers);

	/**
	 * A page renders the option groups the reader picked, so their picks are part of
	 * what a stored copy is a copy of: a reader who has picked stays inside their own
	 * browser's cache, and only the page every reader gets the same way is worth a
	 * shared cache holding.
	 */
	let selections = serializeOptionSelections(await readOptionSelections(request));
	let shared = selections === "";

	/**
	 * A stored copy is what a reader should get, and what an author editing the page
	 * beside it should not: the bundle changes on every save in development, so the
	 * browser revalidates each time and the tag below still answers `304` when the
	 * rendered bytes did not move.
	 */
	let stored = import.meta.env.PROD
		? policy({
				visibility: shared ? "public" : "private",
				maxAge: CLIENT_MAX_AGE,
				sMaxAge: shared ? SHARED_MAX_AGE : undefined,
				staleWhileRevalidate: shared ? "1 day" : undefined,
			})
		: policy({ visibility: "public", noCache: true });

	headers.set("Cache-Control", stored.toString());
	vary(headers, "Cookie");

	let build = buildId();
	if (build !== null) {
		let tag = await etag(`${build}:${new URL(request.url).pathname}:${selections}:${variant}`, {
			weak: true,
		});
		if (isSuccess(tag)) headers.set("ETag", tag.data);
	}

	return await conditional(request, new Response(body, { status: response.status, headers }));
}
