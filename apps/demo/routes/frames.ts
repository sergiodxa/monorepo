/**
 * How a page says it wants a fragment rather than a document. The board's dialog fills
 * itself from the same address its control links to, and a fragment is what belongs inside a
 * document that already has a head, a body and a shell around it.
 *
 * It rides in the address rather than in a header because the client runtime resolves an
 * ordinary link navigation through the same resolver a frame goes through, and the address
 * is the one thing only a frame has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The search parameter naming a request as a frame's. */
export const FRAME_PARAM = "frame";

/**
 * Whether this request asked for a fragment of a page.
 *
 * @param request - The request being answered.
 */
export function isFrameRequest(request: Request): boolean {
	return new URL(request.url).searchParams.has(FRAME_PARAM);
}

/**
 * The fragment address for a page.
 *
 * @param href - The page's own address, which a visitor can open on its own.
 */
export function frameHref(href: string): string {
	return `${href}?${FRAME_PARAM}`;
}
