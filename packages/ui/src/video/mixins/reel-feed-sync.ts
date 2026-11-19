/**
 * Why JS: picking which reel is on screen, loading only the ones around it, pausing the rest,
 * and stepping one reel per key press or wheel flick all need the scroller's live position.
 * No-JS baseline: the feed scrolls and snaps by touch, wheel and keys, and the first reel autoplays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin, prefetch } from "remix/component";

/** Set on the feed once its island runs. */
export const REEL_FEED_READY = "data-reel-feed-ready";

/** Set on the reel on screen, which plays while every other reel pauses. */
export const REEL_ACTIVE = "data-reel-active";

/** Set on a reel the visitor paused by tapping it. */
export const REEL_PAUSED = "data-reel-paused";

/** Dispatched, bubbling, from the feed whenever another reel comes on screen. */
export const REEL_CHANGE_EVENT = "ui:reel-change";

/** How long the wheel must rest before another flick steps again, so one flick moves one reel. */
const WHEEL_REST_MS = 220;

/** The smallest wheel travel that counts as a flick, which drops a trackpad's stray nudges. */
const WHEEL_THRESHOLD = 12;

/** What {@link REEL_CHANGE_EVENT} carries. */
export interface ReelChangeDetail {
	/** The reel's position in the feed, from 0. */
	index: number;
	/** The reel's own address. */
	href: string;
}

/**
 * The `preload` a reel's video gets by its distance from the reel on screen: the current and the
 * next load whole, the one after loads its metadata, and every other one waits.
 *
 * @param offset The reel's index minus the current reel's index.
 * @returns The value for the video's `preload` attribute.
 * @example reelPreload(1) // "auto"
 */
export function reelPreload(offset: number): "auto" | "metadata" | "none" {
	if (offset === 0 || offset === 1) return "auto";
	return offset === 2 ? "metadata" : "none";
}

/**
 * Runs the feed it sits in: watches which reel fills the scroller, slides the preload window,
 * plays that reel and pauses the rest, follows its address, prefetches the next reel's page,
 * and steps one reel at a time for the arrow keys, Page keys, `j`/`k`, the wheel and any
 * `data-reel-step` control inside the feed.
 */
export const reelFeedSync: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let feed = event.node.closest<HTMLElement>("[data-slot=reel-feed]");
		let scroller = feed?.querySelector<HTMLElement>("[data-slot=reel-feed-scroller]");
		if (!feed || !scroller) return;
		controller = new AbortController();
		wireFeed(feed, scroller, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/** The reels in feed order. */
function reelsOf(scroller: HTMLElement): HTMLElement[] {
	return [...scroller.querySelectorAll<HTMLElement>(":scope > [data-slot=reel-feed-item]")];
}

/** The video a reel plays, if it has one. */
function videoOf(reel: HTMLElement | undefined): HTMLVideoElement | null {
	return reel?.querySelector<HTMLVideoElement>("video[data-reel-video]") ?? null;
}

/**
 * Plays a muted video, ignoring the refusal a browser gives when the page has not been
 * interacted with or the video was paused again before it could start.
 */
function play(video: HTMLVideoElement) {
	video.muted = true;
	video.play().catch(() => undefined);
}

/**
 * Wires one feed until `signal` aborts.
 *
 * @param feed The feed's root, which carries its options as data attributes.
 * @param scroller The element that scrolls and snaps.
 * @param signal Ends the wiring.
 */
function wireFeed(feed: HTMLElement, scroller: HTMLElement, signal: AbortSignal): void {
	let reels = reelsOf(scroller);
	let current = Math.max(
		0,
		reels.findIndex((reel) => reel.hasAttribute(REEL_ACTIVE)),
	);
	let follow = feed.hasAttribute("data-follow-address");
	let target = feed.dataset.prefetchTarget;
	let wheelLocked = false;
	let wheelTimer: ReturnType<typeof setTimeout> | undefined;
	let hint: HTMLLinkElement | null = null;
	let touchedAt: number | null = null;

	/** Moves the preload window, the playing reel and the address to the reel at `index`. */
	function activate(index: number, announce: boolean) {
		current = index;
		reels.forEach((reel, position) => {
			let offset = position - index;
			let video = videoOf(reel);
			reel.toggleAttribute(REEL_ACTIVE, offset === 0);
			if (offset !== 0) reel.removeAttribute(REEL_PAUSED);
			if (video === null) return;
			let preload = reelPreload(offset);
			if (video.preload !== preload) video.preload = preload;
			if (offset === 0) {
				if (!reel.hasAttribute(REEL_PAUSED)) play(video);
			} else if (!video.paused) {
				video.pause();
			}
			if (preload !== "none" && video.readyState === 0 && video.networkState !== 2) video.load();
		});
		let reel = reels[index];
		let next = reels[index + 1]?.dataset.href;
		if (next !== undefined) {
			hint = movePrefetchHint(feed, hint, next);
			if (target !== undefined) prefetch(new URL(next, location.href).href, { target });
		}
		let href = reel?.dataset.href;
		if (!announce || reel === undefined || href === undefined) return;
		let url = new URL(href, location.href);
		if (follow && `${url.pathname}${url.search}` !== `${location.pathname}${location.search}`) {
			history.replaceState(history.state, "", href);
		}
		feed.dispatchEvent(
			new CustomEvent<ReelChangeDetail>(REEL_CHANGE_EVENT, {
				bubbles: true,
				detail: { index, href },
			}),
		);
	}

	/** Scrolls to the reel `step` places away, clamped to the feed's ends. */
	function go(step: number) {
		let index = Math.min(reels.length - 1, Math.max(0, current + step));
		let reel = reels[index];
		if (reel === undefined || index === current) return;
		scroller.scrollTo({ top: reel.offsetTop, behavior: scrollBehavior() });
		activate(index, true);
	}

	/**
	 * Whether a key press is the feed's: one from inside it, or any while the feed fills most of
	 * the window and is the page's main content; a small feed on a longer page leaves the page's keys alone.
	 */
	function ownsKeys(event: KeyboardEvent): boolean {
		if (event.target instanceof Node && feed.contains(event.target)) return true;
		return feed.getBoundingClientRect().height >= window.innerHeight * 0.8;
	}

	/** Steps for the keys a visitor reads a vertical feed with, unless they are typing. */
	function onKey(event: KeyboardEvent) {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		let typing =
			event.target instanceof Element &&
			event.target.closest("input, textarea, select, [contenteditable]");
		if (typing || !ownsKeys(event)) return;
		let step = { ArrowDown: 1, PageDown: 1, j: 1, ArrowUp: -1, PageUp: -1, k: -1 }[event.key];
		if (step === undefined) return;
		event.preventDefault();
		go(step);
	}

	/** Turns each flick of the wheel into one step, however many events its momentum sends. */
	function onWheel(event: WheelEvent) {
		if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
		event.preventDefault();
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => (wheelLocked = false), WHEEL_REST_MS);
		if (wheelLocked || Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;
		wheelLocked = true;
		go(event.deltaY > 0 ? 1 : -1);
	}

	/**
	 * Steps for a control marked `data-reel-step` (`1` or `-1`) inside the feed, such as a link
	 * to the next reel's page, which then moves the feed in place.
	 */
	function onStep(event: MouseEvent) {
		let control =
			event.target instanceof Element
				? event.target.closest<HTMLElement>("[data-reel-step]")
				: null;
		if (control === null || !feed.contains(control)) return;
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		go(Number(control.dataset.reelStep) < 0 ? -1 : 1);
	}

	/** Pauses or resumes the reel whose stage was pressed. */
	function onToggle(event: Event) {
		let button =
			event.target instanceof Element ? event.target.closest("[data-reel-toggle]") : null;
		let reel = button?.closest<HTMLElement>("[data-slot=reel-feed-item]");
		let video = videoOf(reel ?? undefined);
		if (!reel || !video) return;
		let paused = !reel.hasAttribute(REEL_PAUSED);
		reel.toggleAttribute(REEL_PAUSED, paused);
		button?.setAttribute("aria-pressed", paused ? "true" : "false");
		if (paused) video.pause();
		else play(video);
	}

	/** Loops a video at its reel's own length and draws the reel's progress line. */
	function onTime(event: Event) {
		let video = event.target;
		if (!(video instanceof HTMLVideoElement) || !video.hasAttribute("data-reel-video")) return;
		let length = Number(video.dataset.loopAt) || video.duration;
		if (!Number.isFinite(length) || length <= 0) return;
		if (video.currentTime >= length) video.currentTime = 0;
		let reel = video.closest<HTMLElement>("[data-slot=reel-feed-item]");
		reel?.style.setProperty("--ui-reel-progress", String(Math.min(1, video.currentTime / length)));
	}

	/**
	 * Settles a touch gesture on the reel next to the one it started from, so a long fling
	 * moves one reel even where a browser carries its momentum past a snap stop.
	 */
	function onScrollEnd() {
		if (touchedAt === null) return;
		let height = scroller.clientHeight;
		if (height === 0) return;
		let landed = Math.round(scroller.scrollTop / height);
		let step = Math.sign(landed - touchedAt);
		let allowed = Math.min(reels.length - 1, Math.max(0, touchedAt + step));
		touchedAt = null;
		let reel = reels[allowed];
		if (Math.abs(landed - allowed) === 0 || reel === undefined) return;
		scroller.scrollTo({ top: reel.offsetTop, behavior: scrollBehavior() });
		activate(allowed, true);
	}

	let observer = new IntersectionObserver(
		(entries) => {
			for (let entry of entries) {
				if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
				let index = reels.indexOf(entry.target as HTMLElement);
				if (index !== -1 && index !== current) activate(index, true);
			}
		},
		{ root: scroller, threshold: [0.6] },
	);

	let start = reels[current];
	if (start !== undefined && Math.abs(scroller.scrollTop - start.offsetTop) > 1) {
		scroller.scrollTo({ top: start.offsetTop, behavior: "instant" });
	}
	activate(current, false);
	for (let reel of reels) observer.observe(reel);
	feed.setAttribute(REEL_FEED_READY, "");
	document.addEventListener("keydown", onKey, { signal });
	scroller.addEventListener("wheel", onWheel, { passive: false, signal });
	scroller.addEventListener("click", onToggle, { signal });
	feed.addEventListener("click", onStep, { signal });
	scroller.addEventListener("touchstart", () => (touchedAt = current), { passive: true, signal });
	scroller.addEventListener("scrollend", onScrollEnd, { signal });
	scroller.addEventListener("timeupdate", onTime, { capture: true, signal });
	document.addEventListener(
		"visibilitychange",
		() => {
			let video = videoOf(reels[current]);
			if (video === null) return;
			if (document.hidden) video.pause();
			else if (!reels[current]?.hasAttribute(REEL_PAUSED)) play(video);
		},
		{ signal },
	);
	signal.addEventListener("abort", () => {
		observer.disconnect();
		clearTimeout(wheelTimer);
		hint?.remove();
		feed.removeAttribute(REEL_FEED_READY);
		for (let reel of reels) videoOf(reel)?.pause();
	});
}

/** Smooth steps, or instant ones for a visitor who asked for reduced motion. */
function scrollBehavior(): ScrollBehavior {
	return matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

/**
 * Points the feed's document prefetch hint at the next reel's page, so following a shared link
 * to it, or a reload there, finds the page already in the HTTP cache.
 *
 * @returns The hint, created on first use inside the feed.
 */
function movePrefetchHint(
	feed: HTMLElement,
	hint: HTMLLinkElement | null,
	href: string,
): HTMLLinkElement {
	let link = hint ?? feed.querySelector<HTMLLinkElement>("link[data-reel-next]");
	if (link === null) {
		link = document.createElement("link");
		link.rel = "prefetch";
		link.setAttribute("data-reel-next", "");
		feed.appendChild(link);
	}
	if (link.getAttribute("href") !== href) link.setAttribute("href", href);
	return link;
}
