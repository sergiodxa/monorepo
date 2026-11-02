/**
 * Why JS: moving one roving Tab stop through a status strip's bars with ←/→, Home and End needs a
 * key listener. No-JS baseline: the server marks the newest bar as the strip's one Tab stop, so
 * the strip costs a single Tab and that bar's tooltip still shows on focus and every bar on hover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { focusItem, setRovingTabindex } from "../../utils/keyboard-nav.js";

/** The strip the mixin walks when its host sits inside one. */
const STRIP_SELECTOR = '[data-slot="status-strip"]';

/** One bar of the strip, oldest first in document order. */
const BAR_SELECTOR = '[data-slot="status-strip-bars"] > button';

/**
 * Picks the bar a key moves focus to, or `undefined` for a key the strip leaves alone. Arrows
 * stop at either end, and follow the strip's writing direction so → always moves rightwards.
 *
 * @param key The pressed key.
 * @param index The focused bar's position, oldest first.
 * @param count How many bars the strip draws.
 * @param rtl Whether the strip lays out right to left.
 * @returns The position to focus.
 */
function targetIndex(key: string, index: number, count: number, rtl: boolean): number | undefined {
	switch (key) {
		case "Home":
			return 0;
		case "End":
			return count - 1;
		case "ArrowRight":
			return Math.max(0, Math.min(count - 1, index + (rtl ? -1 : 1)));
		case "ArrowLeft":
			return Math.max(0, Math.min(count - 1, index + (rtl ? 1 : -1)));
		default:
			return undefined;
	}
}

/**
 * Keyboard navigation for a status strip's bars: ←/→ step one period, Home and End jump to the
 * oldest and newest, and the Tab stop follows focus, so the bar's tooltip follows too. Apply it
 * to the strip, or to any element inside one, which then walks the enclosing strip.
 *
 * @example <span hidden mix={[statusStripKeys()]} />
 */
export const statusStripKeys: MixinFactory<HTMLElement, []> = createMixin<HTMLElement, []>(
	(handle) => {
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			let signal = controller.signal;
			let strip = event.node.closest<HTMLElement>(STRIP_SELECTOR) ?? event.node;
			let bars = () => [...strip.querySelectorAll<HTMLElement>(BAR_SELECTOR)];

			strip.addEventListener(
				"focusin",
				(focus) => {
					let all = bars();
					if (focus.target instanceof HTMLElement && all.includes(focus.target)) {
						setRovingTabindex(all, focus.target);
					}
				},
				{ signal },
			);

			strip.addEventListener(
				"keydown",
				(key) => {
					if (key.altKey || key.ctrlKey || key.metaKey || key.shiftKey) return;
					let all = bars();
					let index = key.target instanceof HTMLElement ? all.indexOf(key.target) : -1;
					if (index === -1) return;
					let rtl = getComputedStyle(strip).direction === "rtl";
					let next = targetIndex(key.key, index, all.length, rtl);
					if (next === undefined) return;
					key.preventDefault();
					focusItem(all, all[next]!);
				},
				{ signal },
			);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});
	},
);
