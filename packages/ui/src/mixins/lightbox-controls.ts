/**
 * Script layer for a Lightbox `<dialog>`: Left/Right arrow keys step through the photos, a
 * trigger opens the viewer as a modal at the photo it names, the step links scroll in place,
 * and the photo in view is marked current and announced as the track scrolls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { asCommandEvent } from "../utils/command-event.js";

/** Attribute on the scroll-snap track holding every slide. */
export const LIGHTBOX_TRACK_ATTRIBUTE = "data-lightbox-track";

/** Attribute on each slide, in photo order. */
export const LIGHTBOX_SLIDE_ATTRIBUTE = "data-lightbox-slide";

/** Attribute a trigger carries naming the zero-based photo it opens at. */
export const LIGHTBOX_INDEX_ATTRIBUTE = "data-lightbox-index";

/** Attribute a step link carries naming the zero-based photo it scrolls to. */
export const LIGHTBOX_STEP_ATTRIBUTE = "data-lightbox-to";

/** Attribute on the dialog naming the photo a server-opened viewer starts on. */
export const LIGHTBOX_INITIAL_ATTRIBUTE = "data-lightbox-initial";

/** Attribute on the polite live region that names the photo in view. */
export const LIGHTBOX_STATUS_ATTRIBUTE = "data-lightbox-status";

/** Attribute on each slide's counter and caption, read into the announcement. */
export const LIGHTBOX_ANNOUNCE_ATTRIBUTE = "data-lightbox-announce";

/** What one viewer's listeners work against, resolved once when the host is inserted. */
interface Viewer {
	dialog: HTMLDialogElement;
	track: HTMLElement;
	/** The photo last announced; `-1` until the first sync, so the first photo is named too. */
	current: number;
}

/**
 * Parses a zero-based photo index out of an attribute value.
 *
 * @returns The index, or `null` for a missing or malformed value.
 */
function parseIndex(value: string | null | undefined): number | null {
	if (value === null || value === undefined || value === "") return null;
	let index = Number(value);
	return Number.isInteger(index) && index >= 0 ? index : null;
}

/** The viewer's slides in photo order. */
function slidesOf(viewer: Viewer): HTMLElement[] {
	return [...viewer.track.querySelectorAll<HTMLElement>(`[${LIGHTBOX_SLIDE_ATTRIBUTE}]`)];
}

/** Whether the track lays its photos out right to left, which flips the arrow keys. */
function isRightToLeft(node: Element): boolean {
	return getComputedStyle(node).direction === "rtl";
}

/**
 * The photo the track has settled nearest to. Every slide spans the track's full width, so
 * the scroll offset over that width is the index.
 */
function readIndex(viewer: Viewer): number {
	let width = viewer.track.clientWidth;
	if (width === 0) return Math.max(0, viewer.current);
	let last = slidesOf(viewer).length - 1;
	return Math.max(0, Math.min(last, Math.round(Math.abs(viewer.track.scrollLeft) / width)));
}

/**
 * Scrolls the track so photo `index` fills it. A step the visitor asked for animates unless
 * they prefer reduced motion; opening at a photo always lands there instantly.
 */
function goTo(viewer: Viewer, index: number, instant: boolean): void {
	let slides = slidesOf(viewer);
	let slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
	if (!slide) return;
	let trackBox = viewer.track.getBoundingClientRect();
	let slideBox = slide.getBoundingClientRect();
	let offset = isRightToLeft(viewer.track)
		? slideBox.right - trackBox.right
		: slideBox.left - trackBox.left;
	let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
	viewer.track.scrollTo({
		left: viewer.track.scrollLeft + offset,
		behavior: instant || reduced ? "instant" : "smooth",
	});
	sync(viewer);
}

/**
 * Marks the photo in view with `data-current` and, when it changed, names it in the live
 * region, so a screen reader hears "2 / 8" and the caption once per photo.
 */
function sync(viewer: Viewer): void {
	let index = readIndex(viewer);
	let slides = slidesOf(viewer);
	for (let [position, slide] of slides.entries()) {
		if (position === index) slide.setAttribute("data-current", "");
		else slide.removeAttribute("data-current");
	}
	if (index === viewer.current) return;
	viewer.current = index;
	let status = viewer.dialog.querySelector(`[${LIGHTBOX_STATUS_ATTRIBUTE}]`);
	let slide = slides[index];
	if (!status || !slide) return;
	status.textContent = [...slide.querySelectorAll(`[${LIGHTBOX_ANNOUNCE_ATTRIBUTE}]`)]
		.map((part) => part.textContent?.trim() ?? "")
		.filter(Boolean)
		.join(". ");
}

/**
 * Opens the dialog as a modal at photo `index`. A viewer the server rendered open is a
 * non-modal dialog, so it closes first and reopens in the top layer with focus trapped.
 */
function openAt(viewer: Viewer, index: number): void {
	if (viewer.dialog.open && !viewer.dialog.matches(":modal")) viewer.dialog.close();
	if (!viewer.dialog.open) viewer.dialog.showModal();
	goTo(viewer, index, true);
}

/** Wires the command, key, click and scroll listeners for one viewer until `signal` aborts. */
function listen(viewer: Viewer, signal: AbortSignal): void {
	let { dialog, track } = viewer;

	dialog.addEventListener(
		"command",
		(event) => {
			let command = asCommandEvent(event);
			if (command.command !== "show-modal") return;
			let source = command.source;
			let index = source ? parseIndex(source.getAttribute(LIGHTBOX_INDEX_ATTRIBUTE)) : null;
			event.preventDefault();
			openAt(viewer, index ?? 0);
		},
		{ signal },
	);

	dialog.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			let forward = (event.key === "ArrowRight") !== isRightToLeft(track);
			event.preventDefault();
			goTo(viewer, readIndex(viewer) + (forward ? 1 : -1), false);
		},
		{ signal },
	);

	dialog.addEventListener(
		"click",
		(event) => {
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
			if (!(event.target instanceof Element)) return;
			let link = event.target.closest(`[${LIGHTBOX_STEP_ATTRIBUTE}]`);
			let index = link ? parseIndex(link.getAttribute(LIGHTBOX_STEP_ATTRIBUTE)) : null;
			if (index === null) return;
			event.preventDefault();
			goTo(viewer, index, false);
		},
		{ signal },
	);

	track.addEventListener("scroll", () => sync(viewer), { signal, passive: true });
}

/**
 * Attaches the viewer behavior to the `<dialog>` the host sits in, from insertion until
 * removal. A dialog the server rendered open at a photo is upgraded to a modal there.
 *
 * @example
 * <dialog id="photos">
 * 	<span hidden mix={[lightboxControls()]} />
 * 	<div data-lightbox-track>…</div>
 * </dialog>
 */
export const lightboxControls: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let dialog = event.node.closest("dialog");
		let track = dialog?.querySelector<HTMLElement>(`[${LIGHTBOX_TRACK_ATTRIBUTE}]`);
		if (!dialog || !track) return;
		controller = new AbortController();
		let viewer: Viewer = { dialog, track, current: -1 };
		listen(viewer, controller.signal);
		let initial = parseIndex(dialog.getAttribute(LIGHTBOX_INITIAL_ATTRIBUTE));
		if (dialog.open && initial !== null) openAt(viewer, initial);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
