/**
 * The walk back through a newly followed feed's history (RFC 5005): archive by archive
 * along `prev-archive`, or page by page along `next`, storing what each document holds
 * until the history ends, a budget runs out, or a publisher refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

import type { FeedStore } from "~/app/models/feed-store";
import type { HistoryStart } from "~/app/services/refresh";

import { requestSigner } from "~/app/initializers/web-bot-auth";
import { classifyFailure } from "~/app/services/refresh";

/**
 * The most documents one walk requests. An archive is typically a month, so this reaches
 * most of a year back, which is history a reader opens rather than a site's whole past.
 */
export const HISTORY_PAGE_LIMIT = 10;

/**
 * The most entries one walk stores. It keeps a feed archiving a thousand posts a month from
 * filling every follower's timeline with posts they never asked for.
 */
export const HISTORY_ENTRY_LIMIT = 500;

/** How long one document's fetch may take, the same budget a scheduled poll gets. */
const PAGE_TIMEOUT_MS = 10_000;

/** The feed's object, as much of it as a walk needs: where it has been and where to store. */
export interface HistoryStore {
	historyPage(url: string): Promise<FeedStore.HistoryPage | null>;
	storeHistory(page: FeedStore.HistoryPage, entries: Feed.Item[]): Promise<FeedStore.HistoryStored>;
}

/** The bounds and cancellation one walk runs under. */
export interface HistoryOptions {
	pageLimit?: number;
	entryLimit?: number;
	/** Aborts every request the walk still has to make, such as when a job's time runs out. */
	signal?: AbortSignal;
}

/**
 * How a walk ended. `done` is final: the history ran out, a budget did, the chain looped,
 * or the publisher refused a document (RFC 5005 lets them). `retry` is a failure worth
 * trying again, and everything stored so far stays, so the retry answers from 304s.
 */
export type HistoryOutcome =
	| {
			status: "done";
			reason: "end" | "page-limit" | "entry-limit" | "loop" | "refused";
			pages: number;
			inserted: number;
	  }
	| { status: "retry"; message: string; pages: number; inserted: number };

/**
 * Walks a feed's history from `start`, storing each document's entries through `store`.
 * A document stored before is requested conditionally, and a 304 moves on along the link
 * recorded for it, so a walk retried after a failure costs a request per page it passed.
 *
 * @param store - The feed's object.
 * @param start - The first document, and the relation followed from each to the next.
 * @param options - The page and entry budgets, and the signal that cancels the walk.
 * @example let outcome = await walkHistory(feedStore(feedId), { url, rel: "prev-archive" });
 */
export async function walkHistory(
	store: HistoryStore,
	start: HistoryStart,
	options: HistoryOptions = {},
): Promise<HistoryOutcome> {
	let pageLimit = options.pageLimit ?? HISTORY_PAGE_LIMIT;
	let entryLimit = options.entryLimit ?? HISTORY_ENTRY_LIMIT;
	let visited = new Set<string>();
	let url: string | null = start.url;
	let pages = 0;
	let taken = 0;
	let inserted = 0;

	while (url !== null) {
		if (pages >= pageLimit) return { status: "done", reason: "page-limit", pages, inserted };
		if (taken >= entryLimit) return { status: "done", reason: "entry-limit", pages, inserted };
		if (visited.has(url)) return { status: "done", reason: "loop", pages, inserted };
		visited.add(url);

		let stored = await store.historyPage(url);
		let result = await Feed.fetch(url, {
			etag: stored?.etag,
			lastModified: stored?.lastModified,
			signal: deadline(options.signal),
			sign: await requestSigner(),
		});
		pages += 1;

		if (isFailure(result)) {
			let failure = classifyFailure(result.error);
			if (isRefusal(failure)) return { status: "done", reason: "refused", pages, inserted };
			return { status: "retry", message: failure.message, pages, inserted };
		}

		if (result.data.notModified) {
			url = stored?.nextUrl ?? null;
			continue;
		}

		let document = result.data.feed;
		let next =
			(start.rel === "prev-archive" ? document.paging.prevArchive : document.paging.next) ?? null;
		let entries = document.items.slice(0, entryLimit - taken);

		let written = await store.storeHistory(
			{
				url,
				etag: result.data.etag ?? null,
				lastModified: result.data.lastModified ?? null,
				nextUrl: next,
			},
			entries,
		);

		taken += entries.length;
		inserted += written.inserted;
		url = next;
	}

	return { status: "done", reason: "end", pages, inserted };
}

/**
 * Whether a failure is the publisher's answer rather than a fault: a 4xx says the document
 * is gone or withheld, and a document that is no feed will be no feed on a retry either.
 */
function isRefusal(failure: ReturnType<typeof classifyFailure>): boolean {
	if (failure.status === "parse_error") return true;
	return failure.status === "http_error" && failure.httpStatus >= 400 && failure.httpStatus < 500;
}

/** One document's deadline, cut short by the walk's own signal when it aborts first. */
function deadline(signal: AbortSignal | undefined): AbortSignal {
	let timeout = AbortSignal.timeout(PAGE_TIMEOUT_MS);
	return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}
