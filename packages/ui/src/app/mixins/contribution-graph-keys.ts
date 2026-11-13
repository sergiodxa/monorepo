/**
 * Why JS: one shared tooltip that follows the hovered or focused day, and arrow keys that move
 * one roving Tab stop through a contribution graph, both need listeners. No-JS baseline: each day
 * carries a `title` with its count, and the newest day is the graph's one Tab stop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { focusItem, setRovingTabindex } from "../../utils/keyboard-nav.js";

/** The graph the mixin serves when its host sits inside one. */
const GRAPH_SELECTOR = '[data-slot="contribution-graph"]';

/** One focusable day: the cell itself, or the link filling it. */
const DAY_SELECTOR = '[data-slot="contribution-graph-day"]';

/**
 * Picks the day a key moves focus to: ←/→ a week (mirrored right to left), ↑/↓ a weekday,
 * Home and End the row's first and last day, Ctrl+Home and Ctrl+End the first and last day of
 * the range. A move onto a cell outside the range goes nowhere.
 *
 * @param key The pressed key.
 * @param ctrl Whether Ctrl or Meta is held.
 * @param from The focused day's week (column) and weekday (row).
 * @param at Looks up the day at a week and weekday, `undefined` outside the range.
 * @param days Every day, in document order (weekday by weekday).
 * @param rtl Whether the graph lays out right to left.
 * @returns The day to focus, or `undefined` for a key the graph leaves alone.
 */
function targetDay(
	key: string,
	ctrl: boolean,
	from: { week: number; row: number },
	at: (week: number, row: number) => HTMLElement | undefined,
	days: HTMLElement[],
	rtl: boolean,
): HTMLElement | undefined {
	let step = rtl ? -1 : 1;
	switch (key) {
		case "ArrowRight":
			return at(from.week + step, from.row) ?? at(from.week, from.row);
		case "ArrowLeft":
			return at(from.week - step, from.row) ?? at(from.week, from.row);
		case "ArrowDown":
			return at(from.week, from.row + 1) ?? at(from.week, from.row);
		case "ArrowUp":
			return at(from.week, from.row - 1) ?? at(from.week, from.row);
		case "Home":
			if (ctrl) return byDate(days)[0];
			return days.find((day) => position(day).row === from.row);
		case "End":
			if (ctrl) return byDate(days).at(-1);
			return days.filter((day) => position(day).row === from.row).at(-1);
		default:
			return undefined;
	}
}

/**
 * Orders days by date, since the table lists them weekday by weekday.
 *
 * @param days The days in document order.
 * @returns A copy, earliest first.
 */
function byDate(days: HTMLElement[]): HTMLElement[] {
	return [...days].sort((a, b) => (a.dataset.date ?? "").localeCompare(b.dataset.date ?? ""));
}

/**
 * Reads a day's week and weekday from the attributes the server writes.
 *
 * @param day A focusable day.
 * @returns Its column and row in the grid.
 */
function position(day: HTMLElement): { week: number; row: number } {
	return { week: Number(day.dataset.week), row: Number(day.dataset.row) };
}

/**
 * Runs a contribution graph from the island inside it: the host is the graph's shared tooltip
 * (a manual popover), which shows the hovered or focused day's label anchored to that day, and
 * the arrows, Home and End walk the days with a roving Tab stop. Each day's `title` is removed
 * once this runs, so the browser's own tooltip never doubles the shared one.
 *
 * @param anchor The CSS anchor name the tooltip positions against, unique to the graph.
 * @example <div popover="manual" mix={[contributionGraphKeys("--ui-contribution-graph-r1")]} />
 */
export const contributionGraphKeys: MixinFactory<HTMLElement, [anchor: string]> = createMixin<
	HTMLElement,
	[anchor: string]
>((handle) => {
	let anchor = "";
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let signal = controller.signal;
		let tooltip = event.node;
		let graph = tooltip.closest<HTMLElement>(GRAPH_SELECTOR);
		if (!graph) return;
		let days = () => [...graph.querySelectorAll<HTMLElement>(DAY_SELECTOR)];
		let current: HTMLElement | undefined;

		for (let day of days()) day.removeAttribute("title");
		tooltip.style.setProperty("position-anchor", anchor);

		/** Shows the tooltip over `day`, moving the anchor name onto it. */
		let show = (day: HTMLElement) => {
			if (current && current !== day) current.style.removeProperty("anchor-name");
			current = day;
			day.style.setProperty("anchor-name", anchor);
			tooltip.textContent = day.getAttribute("aria-label");
			if (!tooltip.matches(":popover-open")) tooltip.showPopover();
		};

		/** Hides the tooltip unless the day it names still holds focus. */
		let hide = (force = false) => {
			if (!force && current && current === document.activeElement) return;
			if (tooltip.matches(":popover-open")) tooltip.hidePopover();
		};

		graph.addEventListener(
			"pointerover",
			(pointer) => {
				let day = (pointer.target as Element | null)?.closest<HTMLElement>(DAY_SELECTOR);
				if (day && graph.contains(day)) show(day);
			},
			{ signal },
		);

		graph.addEventListener(
			"pointerout",
			(pointer) => {
				let to = (pointer.relatedTarget as Element | null)?.closest<HTMLElement>(DAY_SELECTOR);
				if (to && graph.contains(to)) return;
				hide();
			},
			{ signal },
		);

		graph.addEventListener(
			"focusin",
			(focus) => {
				if (!(focus.target instanceof HTMLElement) || !focus.target.matches(DAY_SELECTOR)) return;
				setRovingTabindex(days(), focus.target);
				show(focus.target);
			},
			{ signal },
		);

		graph.addEventListener("focusout", () => hide(true), { signal });

		graph.addEventListener(
			"keydown",
			(key) => {
				if (!(key.target instanceof HTMLElement) || !key.target.matches(DAY_SELECTOR)) return;
				if (key.key === "Escape") {
					hide(true);
					return;
				}
				if (key.altKey || key.shiftKey) return;
				let all = days();
				let grid = new Map(all.map((day) => [`${day.dataset.week}:${day.dataset.row}`, day]));
				let rtl = getComputedStyle(graph).direction === "rtl";
				let next = targetDay(
					key.key,
					key.ctrlKey || key.metaKey,
					position(key.target),
					(week, row) => grid.get(`${week}:${row}`),
					all,
					rtl,
				);
				if (next === undefined) return;
				key.preventDefault();
				focusItem(all, next);
			},
			{ signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});

	return (name) => {
		anchor = name;
	};
});
