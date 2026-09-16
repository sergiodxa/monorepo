/**
 * Where one page of posts sits among the others, and the addresses that walk away from it.
 *
 * Both reading surfaces show the same list of the same rows and differ only in which posts
 * they hold, so how a page is numbered, how the pages above and below it are addressed, and
 * which of them a frame fetches are all decided here rather than twice. What a surface
 * keeps to itself is its own address: the queue carries the words and the filter a reader
 * narrowed it by, and a feed's page carries the feed in its path, so each hands in a way of
 * building its own addresses and this adds the paging to it.
 *
 * A page is walked in both directions. The one below is fetched as the reader scrolls down
 * to it and the one above as they scroll back up, so both ends of a page carry the next one
 * — and a piece fetched for either end carries only the end it continues, since the page at
 * its other end is already in the document it is written into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí
 */

import { FRAME_NEWER, FRAME_OLDER, FRAME_PARAM } from "~/app/http/render";

/**
 * The parameter carrying how far into the list a page begins. A cursor records where to
 * read from and not how far in that is, so the page that builds a link to the next one
 * counts its own rows and passes the total on; a list walked from the top therefore numbers
 * its rows honestly, and a cursor URL arrived at on its own numbers from one, which is what
 * any list with no other information does.
 */
export const FROM_PARAM = "from";

export namespace ListPaging {
	/**
	 * How one surface addresses a page of itself: its own base address with whatever it
	 * carries in its query, plus the cursor and anything else handed in.
	 *
	 * @param cursor - The boundary the store minted, or `null` for the newest page.
	 * @param extra - Parameters this page's address has to carry beyond the surface's own.
	 */
	export type Address = (cursor: string | null, extra?: Record<string, string>) => string;

	export interface Options {
		address: Address;
		/** The query the page was asked for with, which says how far in this page begins. */
		params: URLSearchParams;
		/** The cursor this page was asked for by, or `null` for the newest. */
		cursor: string | null;
		/** Whether that cursor was refused, which leaves this the newest page instead. */
		isStaleCursor: boolean;
		/** How many rows this page came back with, which is what the page below counts on from. */
		rows: number;
		/** How many rows a full page holds, which is how long the page above this one is. */
		pageSize: number;
		/** The cursors the store minted for the pages either side of this one. */
		cursors: { next: string | null; prev: string | null };
	}

	/** Everything the list needs to draw one page and the ways off both ends of it. */
	export interface Placement {
		/**
		 * Where this page's first row falls in the list as a whole, or `null` for a page that
		 * cannot say.
		 */
		start: number | null;
		/** This page's own address, which the address bar carries while it is being read. */
		pageUrl: string;
		/** The page a row's own mark returns to, which is the page being rendered. */
		returnTo: string;
		/** Where a reader walks to the pages either side, or `null` at either end. */
		cursors: { next: string | null; prev: string | null };
		/** Where the page below is fetched from as the reader reaches the end of this one. */
		continueSrc: string | null;
		/** And the page above, as they scroll back up to it. */
		resumeSrc: string | null;
		/** Whether the rows below this page are already on screen. */
		joinsBelow: boolean;
	}
}

/**
 * Where this page's first row falls in the list as a whole, or `null` for a page that
 * cannot say. The newest page starts at the first row; a page below it is told where it
 * begins by the page that linked to it; and a cursor followed on its own says nothing about
 * how far in it is, so such a page counts from one the way any other list does.
 *
 * @param params - The query the page was asked for with.
 * @param cursor - The cursor this page was asked for by, or `null` for the newest.
 * @param isStaleCursor - Whether the cursor was refused, leaving this the newest page.
 */
function startFrom(
	params: URLSearchParams,
	cursor: string | null,
	isStaleCursor: boolean,
): number | null {
	if (isStaleCursor || cursor === null) return 1;

	let from = params.get(FROM_PARAM);
	if (from === null || !/^\d+$/.test(from)) return null;

	let position = Number.parseInt(from, 10);
	return position > 0 ? position : null;
}

/**
 * Places one page of a list: how its rows are numbered, where the pages either side of it
 * live, and which of them this response carries the way onto.
 *
 * A whole page carries both ends. A piece fetched to continue one carries the end it
 * continues and nothing at the other, where the page that asked for it already sits.
 *
 * @param options - The surface's own addressing, the query it was asked with, and the page
 * the store answered.
 * @example placePage({ address: (c, extra) => queueUrl(view, c, extra), ...page });
 */
export function placePage(options: ListPaging.Options): ListPaging.Placement {
	let { address, cursor, cursors, isStaleCursor, pageSize, params, rows } = options;

	let start = startFrom(params, cursor, isStaleCursor);

	/** What the page below this one is told about where it begins, when this page can say. */
	let below: Record<string, string> = start === null ? {} : { [FROM_PARAM]: String(start + rows) };

	/**
	 * And the page above it, which is a page behind this one and so exactly `pageSize` rows
	 * long: a page with another below it is a full one. A page that cannot say where it
	 * begins cannot say where the one above it does either, and neither is numbered.
	 */
	let above: Record<string, string> =
		start === null || start <= pageSize ? {} : { [FROM_PARAM]: String(start - pageSize) };

	/**
	 * Which way this response continues the page that asked for it, or nothing for a whole
	 * page, which stands on its own and carries both ends.
	 */
	let frame = params.get(FRAME_PARAM);
	let continuesUpward = frame === FRAME_NEWER;
	let continuesDownward = frame === FRAME_OLDER;

	let older = cursors.next === null ? null : address(cursors.next, below);
	let newer = cursors.prev === null ? null : address(cursors.prev, above);

	return {
		start,

		/**
		 * The newest page is the plain address: a reader at the top of a list is looking at
		 * the list rather than at a place inside it.
		 */
		pageUrl:
			cursor === null || isStaleCursor
				? address(null)
				: address(cursor, start === null ? {} : { [FROM_PARAM]: String(start) }),

		returnTo: address(isStaleCursor ? null : cursor),

		cursors: {
			next: continuesUpward ? null : older,
			prev: continuesDownward ? null : newer,
		},

		continueSrc:
			continuesUpward || cursors.next === null
				? null
				: address(cursors.next, { ...below, [FRAME_PARAM]: FRAME_OLDER }),

		resumeSrc:
			continuesDownward || cursors.prev === null
				? null
				: address(cursors.prev, { ...above, [FRAME_PARAM]: FRAME_NEWER }),

		joinsBelow: continuesUpward,
	};
}
