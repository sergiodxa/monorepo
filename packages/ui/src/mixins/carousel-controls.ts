/**
 * Handles the `--ui-prev`, `--ui-next`, and `--ui-goto` commands a Carousel's
 * invoker buttons dispatch at its viewport, turning each into an
 * `Element.scrollBy()` call, and keeps every matching invoker's `disabled`
 * state in sync with whichever scroll edge the viewport currently sits at.
 *
 * Why JS: the Command Invoker API dispatches a `command` event the target
 * element must handle itself — nothing in HTML turns `--ui-prev`/`--ui-next`/
 * `--ui-goto` into an actual scroll, and nothing disables an invoker button
 * once its target can no longer scroll further in that direction.
 * No-JS baseline: the viewport still scrolls by touch, trackpad, and its own
 * scrollbar, snapping between slides through CSS scroll-snap alone; only the
 * invoker buttons stop responding, and none of them render `disabled` at the
 * scroll edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import { asCommandEvent } from "../utils/command-event";

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
 * Resolves the animation to scroll a Carousel command with, collapsing to an
 * instant jump under `prefers-reduced-motion: reduce`. `Element.scrollBy()`'s
 * own smooth-scroll rides the platform's scroll animation, not a CSS
 * transition the animation layer's reduced-motion override already reaches,
 * so this mixin applies the same preference itself.
 *
 * @returns `"instant"` when the user prefers reduced motion, `"smooth"` otherwise.
 */
function resolveScrollBehavior(): ScrollBehavior {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

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
 * Classifies whether `node` has scrolled all the way to the reading-order
 * start (a `--ui-prev` command has nothing left to do) or end (a `--ui-next`
 * command has nothing left to do), first normalizing `scrollLeft`'s
 * right-to-left sign flip into a single 0-to-max reading-order position.
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
	node.scrollBy({ left: sign * node.clientWidth, behavior: resolveScrollBehavior() });
}

/**
 * Scrolls `node` so the slide at `index` among its {@link CAROUSEL_SLIDE_ATTRIBUTE}
 * descendants moves to the viewport's start edge, computing the needed delta
 * from the slide's physical offset — unaffected by direction — against the
 * viewport's own direction-normalized `scrollLeft`.
 *
 * @param node Carousel viewport to scroll.
 * @param index Zero-based position of the target slide, in document order.
 */
function scrollToSlide(node: HTMLElement, index: number): void {
	let slides = node.querySelectorAll<HTMLElement>(`[${CAROUSEL_SLIDE_ATTRIBUTE}]`);
	let slide = slides[index];
	if (slide === undefined) return;

	let targetScrollLeft = isRightToLeft(node)
		? slide.offsetLeft - getMaxScrollLeft(node)
		: slide.offsetLeft;

	node.scrollBy({
		left: targetScrollLeft - node.scrollLeft,
		behavior: resolveScrollBehavior(),
	});
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
 * to whichever of them carries `command`. Invoker buttons are plain,
 * unhydrated server HTML that can render anywhere in the document —
 * including outside the Carousel's own subtree — so this searches the whole
 * document rather than `node`'s descendants.
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
 * Applies, or clears, an invoker button's disabled state: mirrors it onto
 * both the native `disabled` property — so the platform drops it from tab
 * order and stops dispatching its command — and `aria-disabled`, matching
 * every other disabled control's interaction contract.
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
 * viewport, turning its invoker buttons — plain server-rendered
 * `<button commandfor command>` elements that can live anywhere on the page —
 * into working scroll controls once the island hydrates.
 *
 * `--ui-prev`/`--ui-next` scroll the viewport by one page in the reading-order
 * direction its command names, flipping the physical sign under a
 * right-to-left direction. `--ui-goto` reads its invoking button's
 * `data-slide` (a zero-based index) and scrolls the matching descendant
 * carrying {@link CAROUSEL_SLIDE_ATTRIBUTE} to the viewport's start edge.
 * Every command, and every native scroll from touch, trackpad, or the
 * viewport's own scrollbar, re-syncs every matching `--ui-prev`/`--ui-next`
 * button's disabled state against whether the viewport can still scroll
 * further that way; a `ResizeObserver` re-runs the same sync whenever the
 * viewport or its content resizes without the user scrolling at all.
 *
 * The viewport needs a stable `id` for its invoker buttons' `commandfor` to
 * target — the same requirement Invoker Commands impose on any target.
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

		let observer = new ResizeObserver(() => syncInvokerDisabled(viewport));
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
				}),
			],
		});
});
