/**
 * What a post's read and save marks agree on with the routes they post to: the headers that
 * ask for the outcome alone rather than a redirect, and the status a full shelf answers with.
 * Both sides import it, so the browser's marks and the server's answers stay in step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { OPTIMISTIC_TOGGLE_HEADER } from "@sdxc/ui/app";

/** The status a refused save answers an in-place submission with, which is a full shelf. */
export const SHELF_FULL_STATUS = 409;

/**
 * The headers a mark sends when it has already moved the post itself: the kit's optimistic
 * toggle, and the names this app's own marks used before it.
 */
const IN_PLACE_HEADERS = [OPTIMISTIC_TOGGLE_HEADER, "x-reader-in-place", "x-reader-save-in-place"];

/**
 * True when a mark moved the post in place and wants only the outcome, which is a status
 * rather than the page a redirect would send to a reader already further down it.
 *
 * @param request - The submission the route received.
 * @example if (movedInPlace(ctx.request)) return new Response(null, { status: 204 });
 */
export function movedInPlace(request: Request): boolean {
	return IN_PLACE_HEADERS.some((header) => request.headers.has(header));
}
