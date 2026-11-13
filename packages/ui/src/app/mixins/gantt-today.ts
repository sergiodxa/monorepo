/**
 * Why JS: a scroll box starts at its first day, and only script can scroll it to where the
 * reader is in time. No-JS baseline: the chart opens at its first day, and today's line is
 * one sideways scroll away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** How far into the axis's visible width today's line lands: a third, so the past stays in view. */
const TODAY_SHARE = 1 / 3;

/**
 * Applied to a marker inside a `Gantt`: once the chart is laid out, scrolls it sideways so
 * today's line sits a third of the way across the axis's visible width. A Gantt chart the reader
 * already scrolled, or one wide enough to show today, is left where it is.
 *
 * @example <span hidden mix={[ganttToday()]} />
 */
export const ganttToday: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let frame: number | undefined;

	/** Waits two frames, so the chart has its final width, then scrolls it. */
	function attach(event: { node: HTMLElement }): void {
		let marker = event.node;
		frame = requestAnimationFrame(next);

		/** Schedules the scroll for the frame after the first layout. */
		function next(): void {
			frame = requestAnimationFrame(scroll);
		}

		/** Puts today's line a third of the way across the visible axis. */
		function scroll(): void {
			let gantt = marker.closest<HTMLElement>('[data-slot="gantt"]');
			let line = gantt?.querySelector<HTMLElement>('[data-slot="gantt-today"]');
			let list = gantt?.querySelector<HTMLElement>('[data-slot="gantt-corner"]');
			if (!gantt || !line || !list || gantt.scrollLeft !== 0) return;
			let axis = gantt.clientWidth - list.offsetWidth;
			let today = line.getBoundingClientRect().left - gantt.getBoundingClientRect().left;
			if (today >= list.offsetWidth && today <= gantt.clientWidth - axis * TODAY_SHARE) return;
			gantt.scrollLeft = Math.max(0, today - list.offsetWidth - axis * TODAY_SHARE);
		}
	}

	/** Drops a scroll that has not run yet. */
	function detach(): void {
		if (frame !== undefined) cancelAnimationFrame(frame);
	}

	handle.addEventListener("insert", attach);
	handle.addEventListener("remove", detach);
});
