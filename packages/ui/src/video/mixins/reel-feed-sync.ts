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
 * `data-reel-step` control inside the feed. A looping feed runs on past the last reel back to
 * the first.
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
	let advance = feed.hasAttribute("data-auto-advance");
	let loop = feed.hasAttribute("data-loop");
	let clone = loop ? appendLoopClone(scroller, reels[0]) : null;
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
		syncSteps(index);
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

	/**
	 * Points each `data-reel-step` control at the reel it would move to from the one on screen,
	 * and marks it `aria-disabled` at the end it points past, so an arrow is live in both
	 * directions whichever reel the page opened on.
	 */
	function syncSteps(index: number) {
		for (let control of feed.querySelectorAll<HTMLElement>("[data-reel-step]")) {
			let forward = Number(control.dataset.reelStep) >= 0;
			let target =
				reels[index + (forward ? 1 : -1)] ?? (forward && clone !== null ? reels[0] : undefined);
			if (target === undefined) {
				control.setAttribute("aria-disabled", "true");
				continue;
			}
			control.removeAttribute("aria-disabled");
			let href = target.dataset.href;
			if (control instanceof HTMLAnchorElement && href !== undefined) control.href = href;
		}
	}

	/** Scrolls to the reel `step` places away, clamped to the feed's ends. */
	function go(step: number) {
		if (clone !== null && step > 0 && current === reels.length - 1) {
			scroller.scrollTo({ top: clone.offsetTop, behavior: scrollBehavior() });
			return;
		}
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

	/**
	 * Draws the reel's progress line and, at the reel's own length, moves on to the next reel
	 * when the feed advances by itself; the last reel, or any reel in a feed that does not, loops.
	 */
	function onTime(event: Event) {
		let video = event.target;
		if (!(video instanceof HTMLVideoElement) || !video.hasAttribute("data-reel-video")) return;
		let length = Number(video.dataset.loopAt) || video.duration;
		if (!Number.isFinite(length) || length <= 0) return;
		if (video.currentTime >= length) {
			let reel = video.closest<HTMLElement>("[data-slot=reel-feed-item]");
			let index = reel === null ? -1 : reels.indexOf(reel);
			if (advance && index === current && (clone !== null || index < reels.length - 1)) {
				video.pause();
				go(1);
			}
			video.currentTime = 0;
		}
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
		let last = clone === null ? reels.length - 1 : reels.length;
		let allowed = Math.min(last, Math.max(0, touchedAt + step));
		touchedAt = null;
		let reel = allowed === reels.length ? clone : reels[allowed];
		if (Math.abs(landed - allowed) === 0 || reel === undefined || reel === null) return;
		scroller.scrollTo({ top: reel.offsetTop, behavior: scrollBehavior() });
		if (reel !== clone) activate(allowed, true);
	}

	let observer = new IntersectionObserver(
		(entries) => {
			for (let entry of entries) {
				if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
				if (entry.target === clone) {
					touchedAt = null;
					scroller.scrollTo({ top: 0, behavior: "instant" });
					activate(0, true);
					continue;
				}
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
	if (clone !== null) observer.observe(clone);
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
		clone?.remove();
		feed.removeAttribute(REEL_FEED_READY);
		for (let reel of reels) videoOf(reel)?.pause();
	});
}

/**
 * Appends an inert copy of the first reel after the last, so a swipe, key or flick past the end
 * lands on something that looks like the first reel, from which the feed jumps to the real one.
 * The copy carries no ids, loads no video and is hidden from assistive tech.
 *
 * @returns The copy, or `null` for a feed with no reels.
 */
function appendLoopClone(
	scroller: HTMLElement,
	first: HTMLElement | undefined,
): HTMLElement | null {
	if (first === undefined) return null;
	let clone = first.cloneNode(true) as HTMLElement;
	clone.removeAttribute(REEL_ACTIVE);
	clone.removeAttribute("data-href");
	clone.setAttribute("data-reel-clone", "");
	clone.setAttribute("aria-hidden", "true");
	clone.inert = true;
	for (let element of [clone, ...clone.querySelectorAll<HTMLElement>("[id]")])
		element.removeAttribute("id");
	for (let video of clone.querySelectorAll("video")) {
		video.removeAttribute("autoplay");
		video.preload = "none";
		video.removeAttribute("data-reel-video");
	}
	for (let hint of clone.querySelectorAll("link")) hint.remove();
	scroller.appendChild(clone);
	return clone;
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
