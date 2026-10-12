/**
 * How a request says it is for a fragment of a page rather than the page: the header the
 * renderer sends on a frame's sub-request, and the parameter a frame's own address carries,
 * with the directions a list's continuation is fetched in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The header the renderer sends, naming a sub-request as a frame's. */
const FRAME_HEADER = "x-remix-frame";

/**
 * The parameter a frame's own address carries, saying the answer is a fragment of a page
 * rather than the page.
 *
 * It rides in the URL rather than in a header because the client runtime resolves an
 * ordinary link navigation through the same resolver a frame goes through: a header added
 * there would turn every soft navigation into a fragment. The address is the one thing
 * only a frame has.
 */
export const FRAME_PARAM = "frame";

/**
 * What {@link FRAME_PARAM} carries for the piece continuing a page downward, into posts
 * older than the ones on screen. It is the direction a list is normally walked, and the
 * value a frame's address carries unless it says otherwise.
 */
export const FRAME_OLDER = "older";

/**
 * And for the piece continuing a page upward, into posts newer than the ones on screen.
 * The two differ in which end of the fragment carries the way on: the page at the other
 * end is already in the document this is written into.
 */
export const FRAME_NEWER = "newer";

/**
 * Whether this request is for a fragment of a page. The server's resolver says so in a
 * header it sets itself; a frame whose address was built for it says so in that address.
 *
 * @param request - The request being answered.
 */
export function isFrameRequest(request: Request): boolean {
	if (request.headers.has(FRAME_HEADER)) return true;
	return new URL(request.url).searchParams.has(FRAME_PARAM);
}
