/**
 * Client island: holds a `Frame` back until its host approaches the viewport, so a page
 * that continues below the fold fetches the continuation as the reader arrives at it
 * rather than on load.
 *
 * What it renders before that — and what a browser running no script renders forever — is
 * `children`. The continuation replaces them only once script has taken over and the
 * reader has reached the end of what is on screen, which is what makes the plain links a
 * default rather than something hidden and restored.
 *
 * A frame given the address of the page it holds also says so in the address bar as the
 * reader passes through it, so reloading resumes where they had read to rather than at the
 * top of a list they have already walked.
 *
 * A frame can also sit above the rows rather than below them, holding the page the reader
 * came from, which is how a list is walked back up as well as down.
 *
 * Vendored from the `lazy-frames` demo in the Remix repository, which publishes no module
 * to import. Four things differ from the original: the second observer, which the demo
 * used to pause descendant CSS animations while the frame sat off screen, reports which
 * page is on screen instead; the frame's own loading state falls back to `children`,
 * because the links a reader can follow themselves are the right thing to leave standing
 * while their replacement is in the air; `children` is one node rather than many, which is
 * what that default needs; and a frame can be told it sits above the reader, which is what
 * `sitsAbove` covers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/ui";

import { clientEntry, Frame, ref } from "remix/ui";

/**
 * The band at the top of the viewport a page has to reach into to be the one being read.
 * The root is shrunk from the bottom to leave it, so what a frame reports is a crossing of
 * that band rather than anything measured on every scroll tick.
 */
const READING_BAND = "0px 0px -90% 0px";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's
 * props are checked against.
 */
export type LazyFrameProps = {
	/** Where the continuation is fetched from. */
	src: string;
	/** How far ahead of the viewport the fetch starts. */
	rootMargin?: string;
	/** What stands in while the frame is in the air; defaults to {@link children}. */
	fallback?: RemixElement | string | number | boolean | null;
	/**
	 * The address of the page this frame holds, which the address bar carries while the
	 * reader is reading it. Omit for a frame whose content is not a place of its own.
	 */
	url?: string;
	/**
	 * The address of the page this frame sits in, which the address bar goes back to when
	 * the reader scrolls up out of this one. Read alongside {@link url}.
	 */
	parentUrl?: string;
	/**
	 * Whether the frame holds ground the reader has already covered, which is true of one
	 * placed above the rows rather than below them. Such a frame changes on two counts.
	 *
	 * It waits to be approached: a page opened in the middle of a list starts with this
	 * frame on screen, and fetching it there would walk the list back to the top nobody
	 * asked to return to, so it fetches once the reader has scrolled past it and turned
	 * back.
	 *
	 * And it holds the reader's place: what arrives here lands above them and moves
	 * everything below it down, so the page is scrolled by as much as it grew and the rows
	 * they were reading stay under their eyes.
	 */
	sitsAbove?: boolean;
	/**
	 * What the server sends, and what a browser running no script keeps. One node rather
	 * than the original's whole `RemixNode`, since it doubles as the frame's own loading
	 * state and a frame takes one.
	 */
	children?: RemixElement | string | number | boolean | null;
};

/** One mounted frame that knows where it sits, and whether the reader is in it. */
interface Reading {
	/** How deeply nested the frame is, which orders one page of a list against another. */
	depth: number;
	url: string;
	parentUrl: string;
	isReading: boolean;
}

/**
 * Every mounted frame that knows the address of the page it holds. Module scope, so the
 * frames of one list — which nest one inside the next — settle between them which page the
 * reader is actually in rather than each answering for itself and the last to fire winning.
 */
const reading = new Map<Element, Reading>();

/**
 * Every mounted frame that sits above the rows. They nest, since the page fetched into one
 * carries the next one inside it, so a single arrival grows every host it lands in at
 * once. The outermost of them has grown by the whole of it, which is what the reader has
 * to be scrolled past, and it is the only one that answers for it.
 */
const aboveTheRows = new Set<Element>();

/** How deeply `node` sits in the document, which is what orders one frame against another. */
function depthOf(node: Element): number {
	let depth = 0;
	for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) depth += 1;
	return depth;
}

/**
 * Writes the page the reader is in into the address bar.
 *
 * The frames of a list nest, so every page above the one being read is still on screen; the
 * deepest of them is the one the reader is actually in. With none of them reached, the
 * reader is in the page the shallowest frame sits in, which is the top of the list.
 *
 * It replaces rather than pushes: a page scrolled past is not somewhere a reader asked to
 * go, and an entry for each of them would turn Back into a walk up their own scrolling.
 */
function markPlace(): void {
	let deepest: Reading | null = null;
	let shallowest: Reading | null = null;

	for (let entry of reading.values()) {
		if (shallowest === null || entry.depth < shallowest.depth) shallowest = entry;
		if (entry.isReading && (deepest === null || entry.depth > deepest.depth)) deepest = entry;
	}

	let place = deepest?.url ?? shallowest?.parentUrl;
	if (place === undefined) return;

	let target = new URL(place, location.href);
	if (target.href === location.href) return;

	history.replaceState(history.state, "", target.href);
}

/**
 * Defers mounting a Frame until its stable host approaches the viewport.
 *
 * `children` render on the server and before intersection. Once observed, the Frame mounts
 * and its own fallback covers the network request. Once mounted, the Frame remains in the
 * document when it leaves the viewport. Set `url` and `parentUrl` to have the frame report
 * which page the reader is in as they scroll through it.
 */
export const LazyFrame = clientEntry(
	"/resources/components/lazy-frame.tsx#LazyFrame",
	function LazyFrame(handle: Handle<LazyFrameProps>) {
		let requested = false;

		/**
		 * Whether a crossing into view counts as the reader arriving. A frame below the rows
		 * is ahead of them from the first moment, so every crossing counts; one above them is
		 * already on screen when a list opens part way down, and counts only once they have
		 * left it and come back.
		 */
		let isApproachable = handle.props.sitsAbove !== true;

		let observe = ref((node, signal) => {
			let loadObserver = new IntersectionObserver(
				(entries) => {
					if (requested || signal.aborted) return;

					if (!entries.some((entry) => entry.isIntersecting)) {
						isApproachable = true;
						return;
					}

					if (!isApproachable) return;

					/**
					 * Latched before the observer is let go, so a second crossing reported in the
					 * same batch asks for the same page again.
					 */
					requested = true;
					loadObserver.disconnect();
					void handle.update();
				},
				{ rootMargin: handle.props.rootMargin ?? "320px 0px" },
			);

			let placeObserver: IntersectionObserver | undefined;
			let placeHolder: ResizeObserver | undefined;

			/**
			 * Armed first, and torn down by a listener registered in the same breath, so fetching
			 * the next page is what this mixin has done by the time it goes on to anything else.
			 * Reporting which page is being read is a nicety on top of a list that continues;
			 * whatever becomes of it below, the reader keeps scrolling into more posts.
			 */
			loadObserver.observe(node);

			signal.addEventListener(
				"abort",
				() => {
					loadObserver.disconnect();
					placeObserver?.disconnect();
					placeHolder?.disconnect();
					aboveTheRows.delete(node);
					reading.delete(node);
				},
				{ once: true },
			);

			if (handle.props.sitsAbove === true) {
				aboveTheRows.add(node);

				let height = node.getBoundingClientRect().height;

				/**
				 * A page arriving above the reader pushes everything under it down by exactly what
				 * it added, so the document is scrolled by the same amount and the rows they were
				 * reading stay where they were. A resize observer is what makes the two one
				 * movement: it runs after the new rows are laid out and before the frame is
				 * painted, so the correction lands in the same frame as the growth it answers and
				 * there is nothing to see.
				 *
				 * It watches for the life of the frame rather than for the one arrival, so rows
				 * that settle late — a long title wrapping once a font lands — are answered too.
				 */
				placeHolder = new ResizeObserver(() => {
					let grown = node.getBoundingClientRect().height - height;
					if (grown === 0) return;

					height += grown;

					/**
					 * One page arriving three frames up grows this one and every frame it sits
					 * inside by the same amount, and each of them is watching. The outermost holds
					 * the whole of what arrived, so it does the scrolling and the rest keep their
					 * measurements and stay still.
					 */
					for (let outer of aboveTheRows) if (outer !== node && outer.contains(node)) return;

					scrollBy({ top: grown, behavior: "instant" });
				});

				placeHolder.observe(node);
			}

			let { parentUrl, url } = handle.props;

			if (url !== undefined && parentUrl !== undefined) {
				reading.set(node, { depth: depthOf(node), url, parentUrl, isReading: false });

				/**
				 * A frame reaches from the first row of its page to the end of the list, so it
				 * crosses the band above once the reader passes the row it begins with, and stops
				 * crossing it when they scroll back above that row.
				 */
				placeObserver = new IntersectionObserver(
					(entries) => {
						if (signal.aborted) return;

						let entry = reading.get(node);
						let isReading = entries.some((crossing) => crossing.isIntersecting);
						if (!entry || entry.isReading === isReading) return;

						entry.isReading = isReading;
						markPlace();
					},
					{ rootMargin: READING_BAND },
				);

				placeObserver.observe(node);
			}
		});

		return () => (
			<div mix={[observe]}>
				{requested ? (
					<Frame src={handle.props.src} fallback={handle.props.fallback ?? handle.props.children} />
				) : (
					handle.props.children
				)}
			</div>
		);
	},
);

export default LazyFrame;
