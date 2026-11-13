/**
 * Why JS: the time left changes every second after the page renders, and a cached page was
 * rendered against an older clock. No-JS baseline: the countdown reads the time left when the
 * server rendered it, and its `<time datetime>` names the moment it counts down to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { countdownParts } from "../utils/countdown.js";

/** The units a countdown writes, matching each `data-unit` it renders. */
const UNITS = ["days", "hours", "minutes", "seconds"] as const;

/**
 * Applied to a countdown's `<time>`: rewrites each `[data-unit] [data-slot="countdown-value"]`
 * from the `datetime` and the viewer's clock as soon as it is in the document, then once a
 * second, or once a minute when `seconds` is off. At zero it shows the done text and stops.
 *
 * @example <time dateTime={iso} mix={[countdownTick(true)]}>…</time>
 */
export const countdownTick: MixinFactory<HTMLTimeElement, [seconds: boolean]> = createMixin<
	HTMLTimeElement,
	[seconds: boolean]
>((handle) => {
	let seconds = true;
	let timer: ReturnType<typeof setInterval> | undefined;

	/** Writes the time left into the host and reports whether the countdown has more to run. */
	function write(node: HTMLTimeElement): boolean {
		let parts = countdownParts(node.dateTime, Date.now());
		for (let unit of UNITS) {
			let value = node.querySelector(`[data-unit="${unit}"] [data-slot="countdown-value"]`);
			if (value) value.textContent = formatUnit(unit, parts[unit]);
		}
		node.dataset.state = parts.done ? "done" : "running";
		let units = node.querySelector<HTMLElement>('[data-slot="countdown-units"]');
		let done = node.querySelector<HTMLElement>('[data-slot="countdown-done"]');
		if (units) units.hidden = parts.done;
		if (done) done.hidden = !parts.done;
		return !parts.done;
	}

	handle.addEventListener("insert", (event) => {
		clearInterval(timer);
		let node = event.node;
		if (!write(node)) return;
		timer = setInterval(
			() => {
				if (!write(node)) clearInterval(timer);
			},
			seconds ? 1_000 : 60_000,
		);
	});

	handle.addEventListener("remove", () => clearInterval(timer));

	return (next) => {
		seconds = next;
	};
});

/**
 * A unit's figure as the countdown prints it: days as they are, the clock units padded to two
 * digits so the row keeps its width as they tick.
 *
 * @param unit Which unit the figure counts.
 * @param value The whole units left.
 * @returns The text the unit's value shows.
 */
export function formatUnit(unit: (typeof UNITS)[number], value: number): string {
	return unit === "days" ? String(value) : String(value).padStart(2, "0");
}
