/**
 * Why JS: paging a scroller by one screenful and disabling a button at the end it points to
 * both need the scroller's live width and position, which CSS cannot read.
 * No-JS baseline: the shelf scrolls by touch, trackpad, wheel and the Tab key through its
 * cards, with its scrollbar showing and its paging buttons hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Set on the scroller once its paging buttons run, which then hide its scrollbar. */
export const READY_ATTRIBUTE = "data-video-shelf-ready";

/** The attribute a paging button carries: `-1` steps back, `1` steps forward. */
export const STEP_ATTRIBUTE = "data-video-shelf-step";

/**
 * Runs the paging buttons of the shelf it sits in: each step moves one screenful, flipped under
 * right-to-left, and each button disables at the end it points to as the scroller moves or
 * resizes.
 */
export const videoShelfSteps: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let shelf = event.node.closest<HTMLElement>("[data-slot=video-shelf]");
		let scroller = shelf?.querySelector<HTMLElement>("[data-slot=video-shelf-scroller]");
		if (!shelf || !scroller) return;
		controller = new AbortController();
		wireShelf(shelf, scroller, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/**
 * Reveals a shelf's paging buttons and runs them until `signal` aborts, when the buttons hide
 * again and the scroller gets its scrollbar back.
 *
 * @param shelf The shelf's root.
 * @param view Its scroller.
 * @param signal Ends the wiring.
 */
function wireShelf(shelf: HTMLElement, view: HTMLElement, signal: AbortSignal): void {
	let buttons = [...shelf.querySelectorAll<HTMLButtonElement>(`[${STEP_ATTRIBUTE}]`)];

	/** Disables the button that points past the end the scroller sits at. */
	function sync() {
		let rtl = getComputedStyle(view).direction === "rtl";
		let position = rtl ? -view.scrollLeft : view.scrollLeft;
		let max = view.scrollWidth - view.clientWidth;
		for (let button of buttons) {
			let forward = button.getAttribute(STEP_ATTRIBUTE) === "1";
			button.disabled = forward ? position >= max - 1 : position <= 1;
		}
	}

	/** Scrolls one screenful less a peek of half a card, so the card at the edge stays in view. */
	function step(button: HTMLButtonElement) {
		let rtl = getComputedStyle(view).direction === "rtl";
		let direction = Number(button.getAttribute(STEP_ATTRIBUTE)) * (rtl ? -1 : 1);
		let item = view.querySelector("[data-slot=video-shelf-item]");
		let peek = item === null ? 0 : item.getBoundingClientRect().width / 2;
		view.scrollBy({ left: direction * Math.max(view.clientWidth - peek, peek) });
	}

	for (let button of buttons) {
		button.hidden = false;
		button.addEventListener("click", () => step(button), { signal });
	}
	view.setAttribute(READY_ATTRIBUTE, "");
	view.addEventListener("scroll", sync, { passive: true, signal });
	let observer = new ResizeObserver(sync);
	observer.observe(view);
	sync();
	signal.addEventListener("abort", () => {
		observer.disconnect();
		view.removeAttribute(READY_ATTRIBUTE);
		for (let button of buttons) button.hidden = true;
	});
}
