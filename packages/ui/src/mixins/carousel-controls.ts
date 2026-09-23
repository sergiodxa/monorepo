/**
 * Handles the `--ui-prev`, `--ui-next`, and `--ui-goto` commands a Carousel's
 * invoker buttons dispatch at its viewport, turning each into an
 * `Element.scrollBy()` call, and keeps every matching invoker's `disabled`
 * state in sync with whichever scroll edge the viewport currently sits at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import { asCommandEvent } from "../utils/command-event.js";

/** Command a Previous-slide invoker button dispatches at the Carousel viewport. */
const PREV_COMMAND = "--ui-prev";

/** Command a Next-slide invoker button dispatches at the Carousel viewport. */
const NEXT_COMMAND = "--ui-next";

/**
 * Command a pagination invoker button dispatches at the Carousel viewport,
 * carrying the zero-based index of its target slide as `event.source.dataset.slide`.
 */
const GOTO_COMMAND = "--ui-goto";

/**
 * Attribute every Carousel slide exposes itself on. {@link carouselControls}
 * queries every element carrying this attribute beneath the viewport, in
 * document order, to resolve the slide a `--ui-goto` command targets.
 */
export const CAROUSEL_SLIDE_ATTRIBUTE = "data-carousel-slide";

/**
 * How many pixels of rounding error `scrollLeft` may still sit at from a true
 * scroll edge and count as having reached it, so sub-pixel layout rounding
 * never leaves both — or neither — of a pair of invoker buttons enabled.
 */
const EDGE_TOLERANCE_PX = 1;

/**
 * Reports whether `node` renders in a right-to-left writing direction, so
 * scroll math can flip which physical direction counts as "previous" and
 * "next" in reading order.
 *
 * @param node Element whose computed direction is read.
 */
function isRightToLeft(node: Element): boolean {
	return getComputedStyle(node).direction === "rtl";
}

/**
 * Furthest a scroll container can move along its inline axis: the gap
 * between its full content width and the width actually visible at once.
 *
 * @param node Scroll container to measure.
 */
function getMaxScrollLeft(node: HTMLElement): number {
	return Math.max(0, node.scrollWidth - node.clientWidth);
}

/**
 * Classifies whether `node` has scrolled to the reading-order start (nothing
 * left for `--ui-prev`) or end (nothing left for `--ui-next`), normalizing
 * `scrollLeft`'s right-to-left sign flip into a 0-to-max reading position.
 *
 * @param node Scroll container to read the current position of.
 */
function readScrollEdges(node: HTMLElement): { atStart: boolean; atEnd: boolean } {
	let maxScrollLeft = getMaxScrollLeft(node);
	let readingPosition = isRightToLeft(node) ? -node.scrollLeft : node.scrollLeft;

	return {
		atStart: readingPosition <= EDGE_TOLERANCE_PX,
		atEnd: readingPosition >= maxScrollLeft - EDGE_TOLERANCE_PX,
	};
}

/**
 * Scrolls `node` by one full viewport page in the given reading-order
 * direction, flipping the physical sign under a right-to-left direction so
 * "forward" always advances in reading order regardless of `dir`.
 *
 * @param node Carousel viewport to scroll.
 * @param direction `-1` for a `--ui-prev` command, `1` for `--ui-next`.
 */
function scrollByPage(node: HTMLElement, direction: -1 | 1): void {
	let sign = isRightToLeft(node) ? -direction : direction;
	node.scrollBy({ left: sign * node.clientWidth });
}

/**
 * Scrolls `node` so the slide at `index` among its
 * {@link CAROUSEL_SLIDE_ATTRIBUTE} descendants moves to the viewport's start
 * edge, accounting for `node`'s right-to-left direction.
 *
 * @param node Carousel viewport to scroll.
 * @param index Zero-based position of the target slide, in document order.
 */
function scrollToSlide(node: HTMLElement, index: number): void {
	let slides = node.querySelectorAll<HTMLElement>(`[${CAROUSEL_SLIDE_ATTRIBUTE}]`);
	let slide = slides[index];
	if (slide === undefined) return;

	/*
	 * Measured against the viewport's own box rather than through `offsetLeft`, which
	 * reports a distance from whichever ancestor happens to be positioned — usually the
	 * page — and so scrolls the carousel by however far it sits from that ancestor.
	 */
	let viewportEdges = node.getBoundingClientRect();
	let slideEdges = slide.getBoundingClientRect();

	/*
	 * Given as a position rather than a distance. A distance is measured against wherever
	 * the viewport happens to be at that instant, so a second command arriving while the
	 * first is still animating moves by an amount that is already stale; a position is the
	 * same answer however many times it is asked, and the scroller simply retargets.
	 */
	node.scrollTo({
		left:
			node.scrollLeft +
			(isRightToLeft(node)
				? slideEdges.right - viewportEdges.right
				: slideEdges.left - viewportEdges.left),
	});
}

/**
 * Reads which slide the viewport has settled on: the one whose start edge sits nearest
 * the viewport's own, which is the slide a mandatory snap leaves in view.
 *
 * @param node Carousel viewport to read.
 * @returns The zero-based position of the slide in view, or `null` when there are none.
 */
function readCurrentSlideIndex(node: HTMLElement): number | null {
	let slides = node.querySelectorAll<HTMLElement>(`[${CAROUSEL_SLIDE_ATTRIBUTE}]`);
	if (slides.length === 0) return null;

	let viewportEdges = node.getBoundingClientRect();
	let rightToLeft = isRightToLeft(node);
	let closest = 0;
	let shortest = Number.POSITIVE_INFINITY;

	for (let [index, slide] of slides.entries()) {
		let slideEdges = slide.getBoundingClientRect();
		let distance = Math.abs(
			rightToLeft ? slideEdges.right - viewportEdges.right : slideEdges.left - viewportEdges.left,
		);
		if (distance < shortest) {
			shortest = distance;
			closest = index;
		}
	}

	return closest;
}

/**
 * Marks whichever `--ui-goto` invoker names the slide in view, so a row of them reads as
 * a position indicator rather than as five identical buttons.
 *
 * @param node Carousel viewport whose scroll position is read.
 */
function syncGotoCurrent(node: HTMLElement): void {
	let current = readCurrentSlideIndex(node);
	if (current === null) return;

	for (let button of findInvokerButtons(node, GOTO_COMMAND)) {
		if (readGotoSlideIndex(button) === current) button.setAttribute("aria-current", "true");
		else button.removeAttribute("aria-current");
	}
}

/**
 * Parses a `--ui-goto` command's target slide index from its invoking
 * button's `data-slide` attribute.
 *
 * @param source Invoking element the `command` event names as its `source`.
 * @returns The parsed zero-based index, or `null` when `source` carries no valid one.
 */
function readGotoSlideIndex(source: Element | null): number | null {
	if (!(source instanceof HTMLElement)) return null;

	let raw = source.dataset.slide;
	if (raw === undefined) return null;

	let index = Number(raw);
	return Number.isInteger(index) && index >= 0 ? index : null;
}

/**
 * Finds every invoker button targeting `node` through `commandfor`, narrowed
 * to whichever carries `command`. Invoker buttons can render anywhere in the
 * document, so this searches the whole document, not just `node`'s descendants.
 *
 * @param node Carousel viewport the invoker buttons target.
 * @param command `--ui-prev` or `--ui-next`, the command to filter for.
 */
function findInvokerButtons(node: HTMLElement, command: string): HTMLButtonElement[] {
	if (node.id === "") return [];

	let candidates = document.querySelectorAll(`[commandfor="${CSS.escape(node.id)}"]`);
	let buttons: HTMLButtonElement[] = [];

	for (let candidate of candidates) {
		if (candidate instanceof HTMLButtonElement && candidate.getAttribute("command") === command) {
			buttons.push(candidate);
		}
	}

	return buttons;
}

/**
 * Applies, or clears, an invoker button's disabled state: sets the native
 * `disabled` property, which drops it from tab order and stops it dispatching
 * its command, and mirrors it onto `aria-disabled` to match the contract.
 *
 * @param button Invoker button to update.
 * @param disabled Whether the button's target direction has nothing left to scroll toward.
 */
function setInvokerDisabled(button: HTMLButtonElement, disabled: boolean): void {
	button.disabled = disabled;
	if (disabled) button.setAttribute("aria-disabled", "true");
	else button.removeAttribute("aria-disabled");
}

/**
 * Mirrors `node`'s current scroll position onto every `--ui-prev`/`--ui-next`
 * invoker button targeting it, disabling whichever direction has nothing left
 * to scroll toward.
 *
 * @param node Carousel viewport whose scroll edges are read.
 */
function syncInvokerDisabled(node: HTMLElement): void {
	let { atStart, atEnd } = readScrollEdges(node);

	for (let button of findInvokerButtons(node, PREV_COMMAND)) setInvokerDisabled(button, atStart);
	for (let button of findInvokerButtons(node, NEXT_COMMAND)) setInvokerDisabled(button, atEnd);
}

/**
 * Adds `--ui-prev`/`--ui-next`/`--ui-goto` command handling to a Carousel
 * viewport, scrolling by page or to a `data-slide` index and, on every command,
 * scroll and resize, re-syncing what the invokers say: each `--ui-prev`/`--ui-next`
 * button's disabled state, and `aria-current` on whichever `--ui-goto` button names
 * the slide in view.
 *
 * @example
 * <div id="cart-carousel" mix={carouselControls()}>
 *   <div data-carousel-slide>Slide 1</div>
 *   <div data-carousel-slide>Slide 2</div>
 * </div>
 * <button commandfor="cart-carousel" command="--ui-prev">Previous</button>
 * <button commandfor="cart-carousel" command="--ui-next">Next</button>
 * <button commandfor="cart-carousel" command="--ui-goto" data-slide="1">Slide 2</button>
 */
export const carouselControls = createMixin<HTMLElement>((handle) => {
	handle.addEventListener("insert", (event) => {
		let viewport = event.node;

		syncInvokerDisabled(viewport);
		syncGotoCurrent(viewport);

		let observer = new ResizeObserver(() => {
			syncInvokerDisabled(viewport);
			syncGotoCurrent(viewport);
		});
		observer.observe(viewport);
		handle.signal.addEventListener("abort", () => observer.disconnect());
	});

	return () =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "command">("command", (event) => {
					let commandEvent = asCommandEvent(event);
					let viewport = event.currentTarget;

					switch (commandEvent.command) {
						case PREV_COMMAND:
							scrollByPage(viewport, -1);
							return;
						case NEXT_COMMAND:
							scrollByPage(viewport, 1);
							return;
						case GOTO_COMMAND: {
							let index = readGotoSlideIndex(commandEvent.source);
							if (index !== null) scrollToSlide(viewport, index);
							return;
						}
					}
				}),
				on<HTMLElement, "scroll">("scroll", (event) => {
					syncInvokerDisabled(event.currentTarget);
					syncGotoCurrent(event.currentTarget);
				}),
			],
		});
});
