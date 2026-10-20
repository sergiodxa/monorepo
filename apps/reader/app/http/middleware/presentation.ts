/**
 * Publishes how this reader's pages are painted, read off the `reader:presentation` cookie
 * before any controller runs, so the document shell writes the answer into the first byte
 * rather than correcting a page that has already been painted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { PRESENTATION_COOKIE, readPresentation } from "~/app/initializers/cookies";

/** Resolves the request's presentation, falling back to the defaults for any value that is not one. */
export let presentation: Middleware = async (ctx, next) => {
	ctx.presentation = readPresentation(
		await PRESENTATION_COOKIE.parse(ctx.request.headers.get("Cookie")),
	);

	return next();
};

export default presentation;
