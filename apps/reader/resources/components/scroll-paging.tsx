/**
 * Client island: fetches the next page of the list when the reader reaches the end of the
 * one on screen and appends its rows to the list already rendered, so a long queue is read
 * by scrolling rather than by asking for each page in turn.
 *
 * It enhances the server's own paging rather than replacing it. The rows and the link to
 * the older page are rendered and sent whether or not this script runs; what this adds is
 * fetching that page early and putting it where the reader already is. The rows are moved
 * across as the server wrote them, which is what keeps a title's read report and a row's
 * own mark working on a page nobody navigated to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { gap } from "@sdxc/u/layout";
import { Button, SentinelRow } from "@sdxc/ui";
import { clientEntry, on, ref } from "remix/ui";

/**
 * How far below the end of the list the next page starts arriving. A page fetched as the
 * end comes into view arrives after the reader has run out of rows; a page fetched a
 * screenful early is usually already there when they get to it.
 */
const PREFETCH_MARGIN = "400px";

/** What the row at the end of the list has to say, which is what the reader is waiting on. */
type Status = "idle" | "loading" | "failed" | "end";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's
 * props are checked against.
 */
type ScrollPagingProps = {
	/** The `id` of the list fetched rows are appended to. */
	listId: string;
	/** The page fetched first, which is the one the server's own older-posts link carries. */
	next: string;
	/** Said while a page is on its way. */
	loadingLabel: string;
	/** Said when a page did not arrive. */
	failedLabel: string;
	/** Asks again for the page that did not arrive. */
	retryLabel: string;
	/** Said once the list has no older page left, so it is known to have an end. */
	endLabel: string;
};

/**
 * Appends pages to the list named by {@link ScrollPagingProps.listId} as the reader
 * reaches the end of it, and says at the end of the list what it is doing.
 */
export const ScrollPaging = clientEntry(
	"/resources/components/scroll-paging.tsx#ScrollPaging",
	function ScrollPaging(handle: Handle<ScrollPagingProps>) {
		let next: string | null = handle.props.next;
		let status: Status = "idle";
		let isLoading = false;
		let sentinel: Element | null = null;
		let observer: IntersectionObserver | null = null;

		/** The server's own way to the older page, which is the reader's whatever script does. */
		function pagerLink(): HTMLAnchorElement | null {
			return document.querySelector<HTMLAnchorElement>('a[rel="next"]');
		}

		/**
		 * Keeps the server's link true to what is on screen: pointed past the pages already
		 * appended and marked as the quiet one while this is fetching them, taken off the page
		 * once nothing older is left, and given its words back after a page failed to arrive,
		 * since following it is then the way on.
		 */
		function syncPagerLink(): void {
			let link = pagerLink();
			if (!link) return;

			if (status === "failed") {
				link.removeAttribute("data-paging");
				return;
			}

			link.dataset.paging = "";
			if (next === null) link.hidden = true;
			else link.href = next;
		}

		/**
		 * A reader who outruns the network is still at the end of the list when the page they
		 * waited for lands, and an observer reports a crossing rather than a position, so the
		 * sentinel is watched afresh to be told where it now is.
		 *
		 * A page that failed to arrive waits for the reader instead, since asking again where
		 * it stands asks as fast as the failures come back. The row carries the retry, and
		 * the link beside it has its words back.
		 */
		function watchSentinel(): void {
			if (!observer || !sentinel || next === null || status !== "idle") return;
			observer.unobserve(sentinel);
			observer.observe(sentinel);
		}

		/**
		 * Fetches the page {@link next} names and appends its rows. One page is in the air at
		 * a time, so an observer that fires twice on the way to the end appends it once.
		 */
		async function loadNextPage(): Promise<void> {
			if (isLoading || next === null) return;

			isLoading = true;
			status = "loading";
			await handle.update();

			try {
				let response = await fetch(next, {
					credentials: "same-origin",
					headers: { accept: "text/html" },
					signal: handle.signal,
				});

				if (!response.ok) throw new Error(`The older page answered ${response.status}`);

				let page = new DOMParser().parseFromString(await response.text(), "text/html");
				let list = document.getElementById(handle.props.listId);
				let rows = Array.from(page.getElementById(handle.props.listId)?.children ?? []);

				for (let row of rows) list?.appendChild(document.importNode(row, true));

				next = page.querySelector<HTMLAnchorElement>('a[rel="next"]')?.getAttribute("href") ?? null;
				status = next === null ? "end" : "idle";
			} catch {
				/** A reader who has left takes the fetch with them, and there is no page to say so on. */
				if (handle.signal.aborted) return;
				status = "failed";
			}

			isLoading = false;
			syncPagerLink();
			await handle.update();
			watchSentinel();
		}

		return () => (
			<SentinelRow
				/**
				 * What the list is doing is said where the list ends, so a reader who cannot see
				 * rows arrive is told in words that they did — and told that the list has an end.
				 */
				aria-live="polite"
				mix={[
					gap(2),
					/**
					 * The row is watched from the moment it is in the page, and the link beside it is
					 * marked at the same moment: until then this is a page the server sent, and the
					 * link is the whole of the way on.
					 */
					ref((node, signal) => {
						sentinel = node;
						syncPagerLink();

						observer = new IntersectionObserver(
							(entries) => {
								if (entries.some((entry) => entry.isIntersecting)) void loadNextPage();
							},
							{ rootMargin: PREFETCH_MARGIN },
						);

						observer.observe(node);
						signal.addEventListener("abort", () => observer?.disconnect());
					}),
				]}
			>
				{status === "loading" && handle.props.loadingLabel}
				{status === "end" && handle.props.endLabel}
				{status === "failed" && (
					<>
						{handle.props.failedLabel}
						<Button
							type="button"
							color="neutral"
							variant="ghost"
							size="sm"
							mix={[on("click", () => void loadNextPage())]}
						>
							{handle.props.retryLabel}
						</Button>
					</>
				)}
			</SentinelRow>
		);
	},
);

export default ScrollPaging;
