/**
 * Why JS: a scroller opens at its start, and only script can bring the current day into view.
 * No-JS baseline: the strip opens on its first day, and the current one is a swipe away with
 * its highlight intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/**
 * Applied to a marker inside a `DayStrip`: once laid out, centres the current day (or today,
 * when none is current) in the strip. A strip the reader already scrolled is left where it is.
 *
 * @example <span hidden mix={[dayStripScroll()]} />
 */
export const dayStripScroll: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let frame: number | undefined;

	/** Waits for layout, then centres the day without animating, so nothing slides on load. */
	function attach(event: { node: HTMLElement }): void {
		let marker = event.node;
		frame = requestAnimationFrame(() => {
			let strip = marker.closest<HTMLElement>('[data-slot="day-strip"]');
			let day =
				strip?.querySelector<HTMLElement>('[aria-current="date"]') ??
				strip?.querySelector<HTMLElement>("[data-today]");
			if (!strip || !day || strip.scrollLeft !== 0) return;
			let offset =
				day.getBoundingClientRect().left -
				strip.getBoundingClientRect().left -
				(strip.clientWidth - day.offsetWidth) / 2;
			strip.scrollLeft = Math.max(0, offset);
		});
	}

	/** Drops a scroll that has not run yet. */
	function detach(): void {
		if (frame !== undefined) cancelAnimationFrame(frame);
	}

	handle.addEventListener("insert", attach);
	handle.addEventListener("remove", detach);
});
