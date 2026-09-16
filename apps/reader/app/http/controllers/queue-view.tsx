/**
 * How the reading queue is narrowed, read off a URL and written back into one.
 *
 * Both narrowings ride in the query string, so a queue filtered to what is unread and
 * searched for a word is an address a reader can keep, share and reload rather than a
 * state the page forgets. They compose: every link and every form on that surface carries
 * whichever of the two is in play, so choosing one never drops the other.
 *
 * It sits beside the queue's own controller rather than inside it because the actions that
 * return a reader to the queue — following a feed, sweeping every feed, clearing the whole
 * of it — each build that address too, and a controller importing the page it redirects to
 * would close a circle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { UserStore } from "~/database/user-do";

import { SEARCH_PARAM } from "~/resources/layouts/app";
import routes from "~/routes/web";

/**
 * The parameter carrying how far into the list a page begins. A cursor records where to
 * read from and not how far in that is, so the page that builds a link to the next one
 * counts its own rows and passes the total on; the queue walked from the top therefore
 * numbers its rows honestly, and a cursor URL arrived at on its own numbers from one,
 * which is what any list with no other information does.
 */
export const FROM_PARAM = "from";

/**
 * The parameter naming which of the queue's posts a page holds. The word says what the
 * page holds rather than how it was narrowed, and reads as a sentence with its value:
 * `show=unread`.
 */
export const SHOW_PARAM = "show";

/**
 * What the queue holds when the URL asks for nothing in particular. Showing every post is
 * what this surface does unasked, so that view is the plain address with no parameter on
 * it at all.
 */
const DEFAULT_READ_STATE: UserStore.ReadState = "all";

/** How the reader has narrowed the queue, as both halves of it stand. */
export interface QueueView {
	readState: UserStore.ReadState;
	/**
	 * What the reader typed, exactly as it arrived, since the spacing between the words is
	 * part of what they searched for. Text holding nothing but space narrows nothing.
	 */
	query: string;
}

/**
 * How a URL's query asks for the queue to be narrowed. A read state nobody wrote — a typo,
 * an old link — reads as every post rather than as an error a reader can do nothing about.
 *
 * @param params - The query the page was asked for with.
 * @example let view = readQueueView(ctx.url.searchParams);
 */
export function readQueueView(params: URLSearchParams): QueueView {
	return queueViewOf(params.get(SEARCH_PARAM) ?? "", params.get(SHOW_PARAM) ?? "");
}

/**
 * The same narrowing read off two submitted fields, which is how it reaches the actions
 * that carry it back: a form posts its own fields rather than the address it was sent
 * from.
 *
 * @param query - What the reader typed, as the field held it.
 * @param show - The read state named, which anything unrecognized reads as every post.
 * @example let view = queueViewOf(submitted.q, submitted.show);
 */
export function queueViewOf(query: string, show: string): QueueView {
	return { readState: show === "unread" || show === "read" ? show : DEFAULT_READ_STATE, query };
}

/**
 * The queue's URL under one narrowing, which every link and every redirect back to it
 * carries. A cursor alone would resolve against whatever page the browser is on and would
 * take the reader out of the narrowing they are reading in.
 *
 * @param view - How the queue is narrowed.
 * @param cursor - The boundary the store minted, or `null` for the newest page.
 * @param extra - Anything an action has to report on arrival, such as its own counts.
 * @example <a href={queueUrl({ readState: "unread", query })}>Unread</a>
 */
export function queueUrl(
	view: QueueView,
	cursor: string | null = null,
	extra: Record<string, string> = {},
): string {
	let params = new URLSearchParams();

	if (view.query.trim().length > 0) params.set(SEARCH_PARAM, view.query);
	if (view.readState !== DEFAULT_READ_STATE) params.set(SHOW_PARAM, view.readState);
	if (cursor !== null) params.set("cursor", cursor);
	for (let [name, value] of Object.entries(extra)) params.set(name, value);

	let query = params.toString();
	return query.length === 0
		? routes.reading.index.href()
		: `${routes.reading.index.href()}?${query}`;
}

/**
 * The narrowing a form carries back with it, since a form posts its own fields and not the
 * address it was submitted from. A reader who follows a feed while reading their unread
 * posts about one word is returned to exactly that.
 */
export function QueueFields(handle: Handle<QueueView>) {
	return () => {
		let { query, readState } = handle.props;

		return (
			<>
				{query.trim().length > 0 && <input type="hidden" name={SEARCH_PARAM} value={query} />}
				{readState !== DEFAULT_READ_STATE && (
					<input type="hidden" name={SHOW_PARAM} value={readState} />
				)}
			</>
		);
	};
}
