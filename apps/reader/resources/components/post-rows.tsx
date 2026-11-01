/**
 * What a list of posts does in a browser beyond its marks: a row restyles as its read mark
 * flips, the sidebar's counts are redrawn once the server confirms, a swipe on a phone row
 * marks it, and following a title marks the post read on the way out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OptimisticToggleEvent } from "@sdxc/ui/app";
import type { Handle } from "remix/component";

import { clientEntry, ref } from "remix/component";

import { SIDEBAR_FEEDS_FRAME } from "~/resources/components/sidebar-frame";

/** The attribute a row wears while its post has been read, which its words are coloured by. */
const ROW_READ = "data-read";

/** The attribute marking a row, which every handler finds its row by. */
const ROW = "[data-post]";

/** The row's read mark, a form posting to the post's own read address. */
const READ_FORM = 'form[action$="/read"]';

/** A row's title, the link out to the publisher. */
const TITLE = "a[data-post-title]";

/** How far a finger has to travel across a row before lifting it counts as a swipe. */
const SWIPE_THRESHOLD = 64;

/** How far the row follows the finger, so a long swipe never drags it off the screen. */
const SWIPE_TRAVEL = 96;

/** Where the gesture is on, which is the width a row stacks its columns at. */
const PHONE_ROW = "(max-width: 33.999rem)";

/**
 * Events already handled. A page can hold several lists, one per page of posts fetched in
 * below it, and each listens on the document, so the first one to see an event takes it.
 */
const HANDLED = new WeakSet<Event>();

/** True the first time any list sees `event`, so one press is acted on once. */
function claim(event: Event): boolean {
	if (HANDLED.has(event)) return false;
	HANDLED.add(event);
	return true;
}

/** Narrows a document-level event to the kit toggle's, which carries its state on itself. */
function isToggleEvent(event: Event): event is OptimisticToggleEvent {
	return "pressed" in event && "settled" in event && "failed" in event;
}

/** The read mark in the row `element` sits in, if it has one. */
function readFormOf(element: Element): HTMLFormElement | null {
	return element.closest(ROW)?.querySelector<HTMLFormElement>(READ_FORM) ?? null;
}

/** Whether this reader asked to be moved about, which the row's travel is the whole of. */
function allowsMotion(): boolean {
	return globalThis.matchMedia?.("(prefers-reduced-motion: no-preference)").matches ?? false;
}

/** Carries `row` with the finger, or settles it back when `distance` is zero. */
function travel(row: HTMLElement, distance: number) {
	if (!allowsMotion()) return;
	row.style.transform = distance === 0 ? "" : `translateX(${distance}px)`;
	row.style.transition = distance === 0 ? "transform 150ms ease-out" : "";
}

/**
 * Listens on the document for what every row of every list on the page does, and returns
 * nothing to draw: the rows and their marks are the server's, and this only joins them up.
 */
export const PostRows = clientEntry(import.meta.url, function PostRows(handle: Handle) {
	let attach = ref((_node, signal) => {
		/**
		 * The read mark flips at once and again if the server refuses, and the row follows it.
		 * Once the server confirms, the sidebar's counts are redrawn from what it now holds.
		 */
		document.addEventListener(
			"ui:optimistic-toggle",
			(event) => {
				if (!isToggleEvent(event) || !(event.target instanceof HTMLFormElement)) return;
				if (!event.target.matches(READ_FORM) || !claim(event)) return;

				event.target.closest(ROW)?.toggleAttribute(ROW_READ, event.pressed);

				if (event.settled && !event.failed) {
					void handle.frames.get(SIDEBAR_FEEDS_FRAME)?.reload();
				}
			},
			{ signal },
		);

		/**
		 * Following a title is what a reader does instead of ticking the row, so an unread post
		 * is marked through its own mark, which keeps the row and the counts in step. The
		 * link's `ping` is dropped first, since the mark already tells the server.
		 */
		document.addEventListener(
			"click",
			(event) => {
				if (!(event.target instanceof Element)) return;
				let title = event.target.closest<HTMLAnchorElement>(TITLE);
				if (!title || !claim(event)) return;

				title.removeAttribute("ping");
				let row = title.closest(ROW);
				if (row && !row.hasAttribute(ROW_READ)) readFormOf(title)?.requestSubmit();
			},
			{ signal, capture: true },
		);

		let swipe: { id: number; x: number; row: HTMLElement } | null = null;

		/** A touch on a phone-width row starts a swipe, which only a finger or a pen can make. */
		document.addEventListener(
			"pointerdown",
			(event) => {
				if (event.pointerType === "mouse" || !globalThis.matchMedia?.(PHONE_ROW).matches) return;
				if (!(event.target instanceof Element) || !claim(event)) return;

				let row = event.target.closest<HTMLElement>(ROW);
				if (row) swipe = { id: event.pointerId, x: event.clientX, row };
			},
			{ signal },
		);

		document.addEventListener(
			"pointermove",
			(event) => {
				if (swipe === null || event.pointerId !== swipe.id) return;
				let distance = event.clientX - swipe.x;
				travel(swipe.row, Math.max(-SWIPE_TRAVEL, Math.min(SWIPE_TRAVEL, distance)));
			},
			{ signal },
		);

		/** Lifting the finger past the threshold flips the row's read mark either way. */
		function end(event: PointerEvent) {
			if (swipe === null || event.pointerId !== swipe.id) return;

			let { row, x } = swipe;
			swipe = null;
			travel(row, 0);

			if (Math.abs(event.clientX - x) >= SWIPE_THRESHOLD) readFormOf(row)?.requestSubmit();
		}

		document.addEventListener("pointerup", end, { signal });
		document.addEventListener("pointercancel", end, { signal });
	});

	return () => <div hidden mix={[attach]} />;
});

export default PostRows;
