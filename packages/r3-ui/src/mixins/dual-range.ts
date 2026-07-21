/**
 * Coordinates a two-thumb Slider's pair of native `<input type="range">`
 * elements: whenever either thumb's value moves, keeps the pair ordered by
 * clamping the moved thumb back to its partner's value the instant it would
 * cross it, then reports the settled `{ min, max }` pair together.
 *
 * Why JS: two independent `<input type="range">` elements rendered as a
 * min/max pair have no relationship in HTML — dragging or keying the
 * lower-bound thumb has no way to stop at the upper-bound thumb's current
 * value, or the reverse, and nothing lets a consumer read both thumbs'
 * settled values as one unit.
 * No-JS baseline: both inputs still render as two independent range
 * controls, each keyboard-operable and each posting its own value with the
 * form; only the crossing guard between the pair and the combined
 * `{ min, max }` change notification are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { findPairedRangeInputs } from "../utils/paired-range-inputs";

/**
 * `data-*` attribute a Slider group's paired range inputs carry so
 * {@link dualRange} can tell the lower-bound thumb from the upper-bound
 * thumb. Set it alongside `type="range"` on both inputs the mixin should
 * coordinate.
 */
export const SLIDER_THUMB_ATTRIBUTE = "data-thumb";

/** {@link SLIDER_THUMB_ATTRIBUTE} value the lower-bound thumb of a pair carries. */
export const SLIDER_THUMB_MIN = "min";

/** {@link SLIDER_THUMB_ATTRIBUTE} value the upper-bound thumb of a pair carries. */
export const SLIDER_THUMB_MAX = "max";

/** DOM event type dispatched by {@link dualRange} on its host whenever the settled min/max pair changes. */
const DUAL_RANGE_CHANGE_EVENT = "ui:dual-range-change" as const;

declare global {
	interface HTMLElementEventMap {
		[DUAL_RANGE_CHANGE_EVENT]: DualRangeChangeEvent;
	}
}

/**
 * Dispatched on a Slider group's host by {@link dualRange} whenever either
 * paired thumb settles on a new value, carrying both bounds together so a
 * consumer can render a combined readout (`"$10 – $50"`) or write a hidden
 * form field without reading the two `<input>` elements itself.
 */
export class DualRangeChangeEvent extends Event {
	/** Current value of the lower-bound thumb, after clamping. */
	readonly min: number;
	/** Current value of the upper-bound thumb, after clamping. */
	readonly max: number;
	/** Which thumb the consumer just moved, triggering this settled pair. */
	readonly movedThumb: "min" | "max";

	/**
	 * @param init Settled min/max pair, and which thumb moved, at dispatch time.
	 */
	constructor(init: { min: number; max: number; movedThumb: "min" | "max" }) {
		super(DUAL_RANGE_CHANGE_EVENT, { bubbles: true });
		this.min = init.min;
		this.max = init.max;
		this.movedThumb = init.movedThumb;
	}
}

/**
 * Clamps whichever thumb just moved back to its partner's value the instant
 * it would cross it, so `min` never settles above `max`.
 *
 * @param min Lower-bound thumb of the pair.
 * @param max Upper-bound thumb of the pair.
 * @param movedThumb Which of the two just fired the triggering `input` event.
 */
function clampThumbs(
	min: HTMLInputElement,
	max: HTMLInputElement,
	movedThumb: "min" | "max",
): void {
	if (movedThumb === SLIDER_THUMB_MIN && min.valueAsNumber > max.valueAsNumber) {
		min.valueAsNumber = max.valueAsNumber;
	} else if (movedThumb === SLIDER_THUMB_MAX && max.valueAsNumber < min.valueAsNumber) {
		max.valueAsNumber = min.valueAsNumber;
	}
}

/**
 * Keeps a two-thumb Slider's paired `<input type="range">` elements ordered:
 * dragging or keying the lower-bound thumb past the upper-bound thumb's
 * current value clamps it right back to that value, and the reverse for the
 * upper-bound thumb, so the pair can never cross.
 *
 * Apply it to the Slider group's host element — the element wrapping both
 * range inputs — with each input marked `data-thumb="min"` or
 * `data-thumb="max"` (exported as {@link SLIDER_THUMB_MIN} and
 * {@link SLIDER_THUMB_MAX}) so the mixin can tell the pair apart. It listens
 * for the `input` event bubbling up from either thumb, so no listener needs
 * attaching to the thumbs themselves.
 *
 * Dispatches {@link DualRangeChangeEvent} on the host every time the settled
 * pair changes.
 *
 * @example
 * <div mix={dualRange()}>
 *   <input type="range" data-thumb="min" min={0} max={100} defaultValue={20} />
 *   <input type="range" data-thumb="max" min={0} max={100} defaultValue={80} />
 * </div>
 */
export const dualRange: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let hostNode: HTMLElement | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	/** Clamps the pair for whichever thumb fired `input`, then reports the settled values. */
	function handleThumbInput(target: EventTarget | null): void {
		if (!hostNode || !(target instanceof HTMLInputElement)) return;

		let movedThumb = target.getAttribute(SLIDER_THUMB_ATTRIBUTE);
		if (movedThumb !== SLIDER_THUMB_MIN && movedThumb !== SLIDER_THUMB_MAX) return;

		let thumbs = findPairedRangeInputs(
			hostNode,
			SLIDER_THUMB_ATTRIBUTE,
			SLIDER_THUMB_MIN,
			SLIDER_THUMB_MAX,
		);
		if (!thumbs) return;

		clampThumbs(thumbs.a, thumbs.b, movedThumb);

		hostNode.dispatchEvent(
			new DualRangeChangeEvent({
				min: thumbs.a.valueAsNumber,
				max: thumbs.b.valueAsNumber,
				movedThumb,
			}),
		);
	}

	return () =>
		createElement(handle.element, {
			mix: [on<HTMLElement, "input">("input", (event) => handleThumbInput(event.target))],
		});
});
