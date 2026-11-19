/**
 * Why JS: advancing when a segment's time runs out, pausing while a finger holds, closing on a
 * downward swipe and moving between people without loading a page all need live input and
 * timing that HTML cannot express.
 * No-JS baseline: each tap zone is a link to the previous or next segment's own address, the
 * progress bar fills once, and the close link leaves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Set on the group on screen, whose current segment's bar runs. */
export const STORY_ACTIVE = "data-story-active";

/** Set on the viewer while its story is paused, by a held finger, a key or the pause button. */
export const STORY_PAUSED = "data-story-paused";

/** Set on the viewer once its island runs. */
export const STORY_READY = "data-story-ready";

/** Dispatched, bubbling, from the viewer whenever another segment comes on screen. */
export const STORY_CHANGE_EVENT = "ui:story-change";

/** How long a press must last to count as a hold that pauses rather than a tap. */
const HOLD_MS = 220;

/** How far a finger must pull the story down for the release to close it. */
const CLOSE_DISTANCE = 110;

/** How far a pointer may wander before a press stops counting as a tap. */
const SLOP = 10;

/** What {@link STORY_CHANGE_EVENT} carries. */
export interface StoryChangeDetail {
	/** The address of the segment now on screen. */
	href: string;
}

/**
 * Runs the viewer it sits in: plays the open group's current segment and moves on when its bar
 * fills, steps on taps and arrow keys, pauses for a hold, the space bar or the pause button,
 * moves between groups by horizontal snap, and closes on a downward swipe or Escape. Typing in
 * a field inside it, such as a reply, holds the story still until the field loses focus.
 */
export const storyViewerSync: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let viewer = event.node.closest<HTMLElement>("[data-slot=story-viewer]");
		let track = viewer?.querySelector<HTMLElement>("[data-slot=story-viewer-track]");
		if (!viewer || !track) return;
		controller = new AbortController();
		wireViewer(viewer, track, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/** The groups in viewer order. */
function groupsOf(track: HTMLElement): HTMLElement[] {
	return [...track.querySelectorAll<HTMLElement>(":scope > [data-slot=story-viewer-group]")];
}

/** A group's segments in order. */
function segmentsOf(group: HTMLElement): HTMLElement[] {
	return [...group.querySelectorAll<HTMLElement>("[data-slot=story-viewer-segment]")];
}

/** A group's progress bars, one per segment. */
function barsOf(group: HTMLElement): HTMLElement[] {
	return [...group.querySelectorAll<HTMLElement>("[data-slot=story-viewer-bar]")];
}

/** The index of a group's current segment. */
function currentOf(group: HTMLElement): number {
	return Math.max(
		0,
		segmentsOf(group).findIndex((segment) => segment.hasAttribute("data-current")),
	);
}

/**
 * Wires one viewer until `signal` aborts.
 *
 * @param viewer The viewer's root.
 * @param track The horizontal scroller holding one group per screen.
 * @param signal Ends the wiring.
 */
function wireViewer(viewer: HTMLElement, track: HTMLElement, signal: AbortSignal): void {
	let groups = groupsOf(track);
	let active = Math.max(
		0,
		groups.findIndex((group) => group.hasAttribute(STORY_ACTIVE)),
	);
	let close = viewer.querySelector<HTMLAnchorElement>("[data-story-close]");
	let pauseButton = viewer.querySelector<HTMLButtonElement>("[data-story-pause]");
	let manualPause = false;
	let press: { x: number; y: number; id: number; held: boolean; dragging: boolean } | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let swallowClick = false;
	let closing = false;
	let fullScreen = getComputedStyle(viewer).position === "fixed";

	/** Pauses or resumes the bar and any video, keeping the pause button's state in step. */
	function setPaused(paused: boolean) {
		viewer.toggleAttribute(STORY_PAUSED, paused);
		pauseButton?.setAttribute("aria-pressed", paused ? "true" : "false");
		syncVideos();
	}

	/** Plays the video of the segment on screen and pauses every other. */
	function syncVideos() {
		let paused = viewer.hasAttribute(STORY_PAUSED);
		groups.forEach((group, index) => {
			let current = currentOf(group);
			segmentsOf(group).forEach((segment, position) => {
				let video = segment.querySelector<HTMLVideoElement>("video");
				if (video === null) return;
				if (index === active && position === current && !paused) {
					video.muted = true;
					video.play().catch(() => undefined);
				} else {
					video.pause();
					if (position !== current) video.currentTime = 0;
				}
			});
		});
	}

	/** Shows segment `index` of `group`, filling the bars before it and restarting its own. */
	function show(group: HTMLElement, index: number) {
		let segments = segmentsOf(group);
		let bars = barsOf(group);
		segments.forEach((segment, position) => {
			segment.toggleAttribute("data-current", position === index);
		});
		bars.forEach((bar, position) => {
			bar.toggleAttribute("data-done", position < index);
			bar.removeAttribute("data-current");
		});
		let bar = bars[index];
		if (bar !== undefined) {
			void bar.offsetWidth;
			bar.setAttribute("data-current", "");
		}
		syncZones(group);
		syncVideos();
		let href = segments[index]?.dataset.href;
		if (href === undefined || groups[active] !== group) return;
		let url = new URL(href, location.href);
		if (`${url.pathname}${url.search}` !== `${location.pathname}${location.search}`) {
			history.replaceState(history.state, "", href);
		}
		viewer.dispatchEvent(
			new CustomEvent<StoryChangeDetail>(STORY_CHANGE_EVENT, { bubbles: true, detail: { href } }),
		);
	}

	/** Points a group's tap zones at the segments around its current one, for a middle-click or no script. */
	function syncZones(group: HTMLElement) {
		let index = currentOf(group);
		let position = groups.indexOf(group);
		let segments = segmentsOf(group);
		let previous =
			segments[index - 1]?.dataset.href ??
			(groups[position - 1] && segmentsOf(groups[position - 1]!).at(-1)?.dataset.href) ??
			close?.getAttribute("href");
		let next =
			segments[index + 1]?.dataset.href ??
			(groups[position + 1] && segmentsOf(groups[position + 1]!)[0]?.dataset.href) ??
			close?.getAttribute("href");
		let zones = group.querySelectorAll<HTMLAnchorElement>("[data-story-zone]");
		for (let zone of zones) {
			let href = zone.dataset.storyZone === "next" ? next : previous;
			if (href) zone.setAttribute("href", href);
		}
	}

	/** Makes the group at `index` the one on screen and runs its current segment. */
	function activate(index: number) {
		active = index;
		groups.forEach((group, position) => group.toggleAttribute(STORY_ACTIVE, position === index));
		let group = groups[index];
		if (group !== undefined) show(group, currentOf(group));
	}

	/** Scrolls the track to the group at `index`, or closes past either end. */
	function goToGroup(index: number, segment?: "first" | "last") {
		let group = groups[index];
		if (group === undefined) {
			leave();
			return;
		}
		let segments = segmentsOf(group);
		if (segment === "first") show(group, 0);
		if (segment === "last") show(group, segments.length - 1);
		track.scrollTo({ left: group.offsetLeft, behavior: scrollBehavior() });
		activate(index);
	}

	/** Moves one segment forward, into the next group after the last. */
	function next() {
		let group = groups[active];
		if (group === undefined) return;
		let index = currentOf(group);
		if (index < segmentsOf(group).length - 1) show(group, index + 1);
		else goToGroup(active + 1, "first");
	}

	/** Moves one segment back, into the previous group before the first. */
	function previous() {
		let group = groups[active];
		if (group === undefined) return;
		let index = currentOf(group);
		if (index > 0) show(group, index - 1);
		else if (active > 0) goToGroup(active - 1, "last");
		else show(group, 0);
	}

	/** Leaves the viewer through its close link, so the app's own navigation takes it. */
	function leave() {
		if (closing) return;
		closing = true;
		close?.click();
	}

	/** Runs a tap zone's step in place, unless the press was a hold or a swipe. */
	function onClick(event: MouseEvent) {
		let zone =
			event.target instanceof Element
				? event.target.closest<HTMLElement>("[data-story-zone]")
				: null;
		if (zone === null || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey)
			return;
		event.preventDefault();
		if (swallowClick) {
			swallowClick = false;
			return;
		}
		if (zone.dataset.storyZone === "next") next();
		else previous();
	}

	/** Starts timing a press for a hold, and tracking it for a swipe down. */
	function onPointerDown(event: PointerEvent) {
		if (!event.isPrimary || event.button !== 0) return;
		let card =
			event.target instanceof Element
				? event.target.closest("[data-slot=story-viewer-card]")
				: null;
		if (card === null || (event.target as Element).closest("[data-story-control]")) return;
		press = {
			x: event.clientX,
			y: event.clientY,
			id: event.pointerId,
			held: false,
			dragging: false,
		};
		swallowClick = false;
		clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			if (press === null || press.dragging) return;
			press.held = true;
			setPaused(true);
		}, HOLD_MS);
	}

	/** Follows a downward drag with the card, so the visitor sees the story letting go. */
	function onPointerMove(event: PointerEvent) {
		if (press === null || event.pointerId !== press.id) return;
		let dx = event.clientX - press.x;
		let dy = event.clientY - press.y;
		if (!press.dragging && dy > SLOP && dy > Math.abs(dx)) {
			press.dragging = true;
			clearTimeout(holdTimer);
			viewer.setAttribute("data-story-dragging", "");
			setPaused(true);
		}
		if (!press.dragging) return;
		let pull = Math.max(0, dy);
		viewer.style.setProperty("--ui-story-pull", `${pull}px`);
		viewer.style.setProperty("--ui-story-fade", String(Math.max(0.35, 1 - pull / 600)));
	}

	/** Ends a press: a long enough pull closes, a hold resumes, and either swallows the tap. */
	function onPointerUp(event: PointerEvent) {
		if (press === null || event.pointerId !== press.id) return;
		clearTimeout(holdTimer);
		let { dragging, held, y } = press;
		press = null;
		if (dragging) {
			swallowClick = true;
			viewer.removeAttribute("data-story-dragging");
			if (event.type === "pointerup" && event.clientY - y >= CLOSE_DISTANCE) {
				leave();
				return;
			}
			viewer.style.removeProperty("--ui-story-pull");
			viewer.style.removeProperty("--ui-story-fade");
			setPaused(manualPause);
			return;
		}
		if (held) {
			swallowClick = true;
			setPaused(manualPause);
		}
	}

	/**
	 * Steps, pauses and closes from the keyboard, unless the visitor is typing a reply; a viewer
	 * shown inside a box on a longer page answers only keys pressed inside it.
	 */
	function onKey(event: KeyboardEvent) {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		let typing =
			event.target instanceof Element &&
			event.target.closest("input, textarea, select, [contenteditable]");
		if (typing || !(fullScreen || (event.target instanceof Node && viewer.contains(event.target))))
			return;
		let rtl = getComputedStyle(viewer).direction === "rtl";
		if (event.key === "Escape") leave();
		else if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) next();
		else if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) previous();
		else if (event.key === " " || event.key === "k") {
			if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) {
				if (event.key === " ") return;
			}
			manualPause = !viewer.hasAttribute(STORY_PAUSED);
			setPaused(manualPause);
		} else return;
		event.preventDefault();
	}

	/** Moves on once the bar of the segment on screen fills. */
	function onAnimationEnd(event: AnimationEvent) {
		let bar =
			event.target instanceof HTMLElement
				? event.target.closest<HTMLElement>("[data-slot=story-viewer-bar]")
				: null;
		if (bar === null || !bar.hasAttribute("data-current")) return;
		let group = bar.closest<HTMLElement>("[data-slot=story-viewer-group]");
		if (group === null || groups.indexOf(group) !== active) return;
		next();
	}

	let observer = new IntersectionObserver(
		(entries) => {
			for (let entry of entries) {
				if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
				let index = groups.indexOf(entry.target as HTMLElement);
				if (index !== -1 && index !== active) activate(index);
			}
		},
		{ root: track, threshold: [0.6] },
	);

	let start = groups[active];
	if (start !== undefined && Math.abs(track.scrollLeft - start.offsetLeft) > 1) {
		track.scrollTo({ left: start.offsetLeft, behavior: "instant" });
	}
	for (let group of groups) syncZones(group);
	syncVideos();
	for (let group of groups) observer.observe(group);
	viewer.setAttribute(STORY_READY, "");
	if (fullScreen && !viewer.contains(document.activeElement)) viewer.focus({ preventScroll: true });

	viewer.addEventListener("click", onClick, { signal });
	viewer.addEventListener("pointerdown", onPointerDown, { signal });
	viewer.addEventListener("pointermove", onPointerMove, { signal });
	viewer.addEventListener("pointerup", onPointerUp, { signal });
	viewer.addEventListener("pointercancel", onPointerUp, { signal });
	viewer.addEventListener("animationend", onAnimationEnd, { signal });
	viewer.addEventListener("contextmenu", (event) => press?.held && event.preventDefault(), {
		signal,
	});
	viewer.addEventListener(
		"focusin",
		(event) => {
			if (event.target instanceof Element && event.target.matches("input, textarea"))
				setPaused(true);
		},
		{ signal },
	);
	viewer.addEventListener(
		"focusout",
		(event) => {
			if (event.target instanceof Element && event.target.matches("input, textarea"))
				setPaused(manualPause);
		},
		{ signal },
	);
	pauseButton?.addEventListener(
		"click",
		() => {
			manualPause = !viewer.hasAttribute(STORY_PAUSED);
			setPaused(manualPause);
		},
		{ signal },
	);
	document.addEventListener("keydown", onKey, { signal });
	document.addEventListener("visibilitychange", () => setPaused(document.hidden || manualPause), {
		signal,
	});
	signal.addEventListener("abort", () => {
		observer.disconnect();
		clearTimeout(holdTimer);
		viewer.removeAttribute(STORY_READY);
		for (let video of viewer.querySelectorAll("video")) video.pause();
	});
}

/** Smooth moves, or instant ones for a visitor who asked for reduced motion. */
function scrollBehavior(): ScrollBehavior {
	return matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}
