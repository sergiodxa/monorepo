/**
 * Client island that holds a `Frame` back until the reader reaches it — by scrolling it
 * near the viewport, or by opening the dialog, disclosure or popover around it — and
 * renders `children` until then, so a browser running no script keeps a working page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/component";

import { clientEntry, Frame, ref } from "remix/component";

/**
 * The band at the top of the viewport a frame has to reach into to be the one being read.
 * The root is shrunk from the bottom, so a frame reports a crossing of that band and
 * nothing is measured on scroll.
 */
const READING_BAND = "0px 0px -90% 0px";

/** How far ahead of the viewport an approaching frame starts its fetch. */
const DEFAULT_ROOT_MARGIN = "320px 0px";

/** The elements whose opening loads a frame set to `loadOn="open"`. */
const OPENABLE = "dialog, details, [popover]";

/** Something a frame renders in place of its content: an element, text, or nothing. */
export type LazyFrameContent = RemixElement | string | number | boolean | null;

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's
 * props are checked against.
 */
export type LazyFrameProps = {
	/** Where the frame's content is fetched from. */
	src: string;
	/**
	 * What starts the fetch: `"approach"` once the frame nears the viewport, `"open"` the
	 * first time the closest `<dialog>`, `<details>` or `[popover]` around it opens.
	 *
	 * @default "approach"
	 */
	loadOn?: "approach" | "open";
	/**
	 * How far around the viewport an approaching frame starts its fetch, in
	 * `IntersectionObserver` `rootMargin` syntax.
	 *
	 * @default "320px 0px"
	 */
	rootMargin?: string;
	/** What stands in while the content is in the air; defaults to `children`. */
	fallback?: LazyFrameContent;
	/**
	 * The address of the page this frame holds, which the address bar carries while the
	 * reader is in it, so a reload resumes there. Takes effect together with `parentUrl`.
	 */
	url?: string;
	/** The address of the page this frame sits in, restored when the reader scrolls above it. */
	parentUrl?: string;
	/**
	 * Marks a frame placed above content the reader already sees. It fetches only once the
	 * reader has scrolled past it and come back, and scrolls the page by what it adds so the
	 * content under the reader's eyes stays put.
	 */
	sitsAbove?: boolean;
	/**
	 * The `id` of a link that leads to the same content as a page of its own. Once script
	 * runs, clicking it opens the dialog, disclosure or popover around a `loadOn="open"`
	 * frame and stays on the page.
	 */
	opener?: string;
	/** What the server sends, what stands in until the fetch, and what a scriptless browser keeps. */
	children?: LazyFrameContent;
};

/** What one frame is told when it crosses into or out of the band an observer watches. */
type Crossing = (isIntersecting: boolean) => void;

/** An observer some number of frames watch through, and how one joins or leaves. */
interface SharedObserver {
	watch(node: Element, onCrossing: Crossing): void;
	unwatch(node: Element): void;
}

/**
 * One observer per band, shared by every frame watching it: a list read several pages deep
 * mounts a frame per page, and they all ask the same question of the same viewport.
 */
const OBSERVERS = new Map<string, SharedObserver>();

/**
 * The observer watching `rootMargin`, made by the first frame to ask for it. Crossings are
 * dealt out by target, so each frame hears about itself alone.
 *
 * @param rootMargin - The band around the viewport a crossing of which is reported.
 */
function observerFor(rootMargin: string): SharedObserver {
	let existing = OBSERVERS.get(rootMargin);
	if (existing) return existing;

	/** Weak, so a frame taken off the page is collected whether or not it unwatched. */
	let watchers = new WeakMap<Element, Crossing>();

	let observer = new IntersectionObserver(
		(entries) => {
			for (let entry of entries) watchers.get(entry.target)?.(entry.isIntersecting);
		},
		{ rootMargin },
	);

	let shared: SharedObserver = {
		watch(node, onCrossing) {
			watchers.set(node, onCrossing);
			observer.observe(node);
		},
		unwatch(node) {
			watchers.delete(node);
			observer.unobserve(node);
		},
	};

	OBSERVERS.set(rootMargin, shared);

	return shared;
}

/** One mounted frame that knows the address it holds, and whether the reader is in it. */
interface Reading {
	/** How deeply nested the frame is, which orders one page of a list against another. */
	depth: number;
	url: string;
	parentUrl: string;
	isReading: boolean;
}

/**
 * Every mounted frame that knows its address. Shared, so the frames of one list — which nest
 * one inside the next — settle together which page the reader is in.
 */
const READING = new Map<Element, Reading>();

/**
 * Every mounted frame that sits above the content. They nest, so one arrival grows every
 * host it lands in; the outermost has grown by all of it and is the only one that scrolls.
 */
const ABOVE_THE_CONTENT = new Set<Element>();

/** How deeply `node` sits in the document, which orders one frame against another. */
function depthOf(node: Element): number {
	let depth = 0;
	for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) depth += 1;
	return depth;
}

/**
 * Writes the page the reader is in into the address bar: the deepest frame they have
 * reached, or the page the shallowest frame sits in when they have reached none. It
 * replaces the entry, so Back leaves the list in one step.
 */
function markPlace(): void {
	let deepest: Reading | null = null;
	let shallowest: Reading | null = null;

	for (let entry of READING.values()) {
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
 * Whether the dialog, disclosure or popover is showing.
 *
 * @param container - An element matched by {@link OPENABLE}.
 */
function isOpen(container: Element): boolean {
	if (container instanceof HTMLDialogElement || container instanceof HTMLDetailsElement) {
		return container.open;
	}
	return container.matches(":popover-open");
}

/**
 * Shows the dialog modally, expands the disclosure, or shows the popover.
 *
 * @param container - An element matched by {@link OPENABLE}.
 */
function open(container: Element): void {
	if (container instanceof HTMLDialogElement) return container.showModal();
	if (container instanceof HTMLDetailsElement) {
		container.open = true;
		return;
	}
	if (container instanceof HTMLElement) container.showPopover();
}

/**
 * Loads the frame the first time the closest dialog, disclosure or popover opens, however
 * it opened: an invoker, a script, or a form. A frame whose container is already open
 * loads at once; one with no container renders `children` for good.
 *
 * @param node - The frame's host.
 * @param signal - Aborts when the host leaves the document.
 * @param opener - The `id` of the link turned into the container's opener, when given.
 * @param request - Swaps `children` for the frame.
 */
function watchOpen(
	node: Element,
	signal: AbortSignal,
	opener: string | undefined,
	request: () => void,
): void {
	let container = node.closest(OPENABLE);
	if (container === null) return;

	if (opener !== undefined) {
		document.getElementById(opener)?.addEventListener(
			"click",
			(event) => {
				if (event.defaultPrevented) return;
				event.preventDefault();
				open(container);
			},
			{ signal },
		);
	}

	if (isOpen(container)) return request();

	container.addEventListener(
		"toggle",
		() => {
			if (isOpen(container)) request();
		},
		{ signal },
	);
}

/**
 * Keeps the reader's place while content lands above it: the page is scrolled by what the
 * frame grew, from a resize observer that runs after layout and before paint, so the
 * correction lands in the same frame as the growth. It watches for the frame's whole life,
 * which also answers content that settles late.
 *
 * @param node - The frame's host.
 * @returns The observer, for the caller to disconnect.
 */
function holdPlace(node: Element): ResizeObserver {
	ABOVE_THE_CONTENT.add(node);

	let height = node.getBoundingClientRect().height;

	let observer = new ResizeObserver(() => {
		let grown = node.getBoundingClientRect().height - height;
		if (grown === 0) return;

		height += grown;

		for (let outer of ABOVE_THE_CONTENT) if (outer !== node && outer.contains(node)) return;

		scrollBy({ top: grown, behavior: "instant" });
	});

	observer.observe(node);

	return observer;
}

/**
 * Loads the frame as its host nears the viewport, and, given `url` and `parentUrl`, keeps
 * the address bar on the page the reader is in. Loading is armed first, so the frame still
 * fetches whatever becomes of the address-bar reporting.
 *
 * @param node - The frame's host.
 * @param signal - Aborts when the host leaves the document.
 * @param props - The frame's props.
 * @param request - Swaps `children` for the frame.
 */
function watchApproach(
	node: Element,
	signal: AbortSignal,
	props: LazyFrameProps,
	request: () => void,
): void {
	let loads = observerFor(props.rootMargin ?? DEFAULT_ROOT_MARGIN);
	let places = observerFor(READING_BAND);

	/**
	 * A frame below the content is ahead of the reader from the start, so any crossing
	 * counts; one above it is already on screen when the page opens part way down, and
	 * counts only once the reader has left it and come back.
	 */
	let isApproachable = props.sitsAbove !== true;
	let reportsPlace = false;
	let placeHolder: ResizeObserver | undefined;

	loads.watch(node, (isIntersecting) => {
		if (signal.aborted) return;

		if (!isIntersecting) {
			isApproachable = true;
			return;
		}

		if (!isApproachable) return;

		loads.unwatch(node);
		request();
	});

	signal.addEventListener(
		"abort",
		() => {
			loads.unwatch(node);
			if (reportsPlace) places.unwatch(node);
			placeHolder?.disconnect();
			ABOVE_THE_CONTENT.delete(node);
			READING.delete(node);
		},
		{ once: true },
	);

	if (props.sitsAbove === true) placeHolder = holdPlace(node);

	let { parentUrl, url } = props;
	if (url === undefined || parentUrl === undefined) return;

	READING.set(node, { depth: depthOf(node), url, parentUrl, isReading: false });
	reportsPlace = true;

	/**
	 * A frame reaches from the first item of its page to the end of the list, so it crosses
	 * the band once the reader passes that item, and leaves it when they scroll back above.
	 */
	places.watch(node, (isReading) => {
		if (signal.aborted) return;

		let entry = READING.get(node);
		if (!entry || entry.isReading === isReading) return;

		entry.isReading = isReading;
		markPlace();
	});
}

/**
 * Renders `children` until the reader reaches the frame, then mounts a `Frame` for `src`
 * with `fallback` (or `children`) covering the request. The swap latches: a frame that
 * loaded keeps its content when it leaves the viewport or its container closes.
 *
 * @example <LazyFrame src="/posts?page=2"><a href="/posts?page=2">Older posts</a></LazyFrame>
 * @example <LazyFrame src="/jobs/1?frame" loadOn="open" opener="job-1"><a href="/jobs/1">Read</a></LazyFrame>
 */
export const LazyFrame = clientEntry(
	"@sdxc/lazy-frame/ui#LazyFrame",
	function LazyFrame(handle: Handle<LazyFrameProps>) {
		let requested = false;

		/** Latched before the update, so a second signal in the same tick asks nothing more. */
		function request(): void {
			if (requested) return;
			requested = true;
			void handle.update();
		}

		let watch = ref((node, signal) => {
			if (handle.props.loadOn === "open") {
				watchOpen(node, signal, handle.props.opener, request);
			} else {
				watchApproach(node, signal, handle.props, request);
			}
		});

		return () => (
			<div mix={[watch]}>
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
