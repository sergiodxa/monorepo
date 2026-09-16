/**
 * Publishes how this reader's pages are painted, read off the `reader:presentation` cookie
 * before any controller runs, so the document shell writes the answer into the first byte
 * rather than correcting a page that has already been painted.
 *
 * It reads a cookie rather than the reader's own object because the shell renders for pages
 * with no other reason to touch a reader's storage — the 404 handler, the sign-in page —
 * and because waking a Durable Object on the critical path of a page to decide a class is
 * the wrong cost in the wrong place. The stored row is the record, and the two paths that
 * read both reconcile them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { PRESENTATION_COOKIE, readPresentation } from "~/app/http/cookies";

/** Resolves the request's presentation, falling back to the defaults for any value that is not one. */
export let presentation: Middleware = async (ctx, next) => {
	ctx.presentation = readPresentation(
		await PRESENTATION_COOKIE.parse(ctx.request.headers.get("Cookie")),
	);

	return next();
};

export default presentation;
