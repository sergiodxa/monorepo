/**
 * Drags a ColorArea root as a single two-dimensional gesture: a
 * `pointerdown` inside the root's own rectangle captures the pointer, and
 * every `pointermove` while that pointer stays captured measures its
 * position against the rectangle, maps it onto the paired horizontal- and
 * vertical-axis `<input type="range">` elements' own `min`–`max` ranges, and
 * writes both inputs' `valueAsNumber` together — the one update neither
 * input's own drag handling can produce alone, since each tracks only its
 * own single axis.
 *
 * Why JS: a native `<input type="range">` reports a pointer drag along its
 * own single axis only; nothing in HTML or CSS turns one pointer gesture
 * across a two-dimensional rectangle into a pair of range values moving
 * together, or reads a pointer position against an element's own rectangle
 * at all.
 * No-JS baseline: both axis inputs still render, each a real, independent
 * `<input type="range">` a screen reader announces and a keyboard drives with
 * its own arrow keys, and each still posts its own value with the form; only
 * dragging the rectangle as one combined gesture, and the combined change
 * notification, are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import type { Point } from "../utils/color-math";

import { normalizedPointerPosition } from "../utils/color-math";
import { findPairedRangeInputs } from "../utils/paired-range-inputs";

/**
 * `data-*` attribute a ColorArea's paired axis inputs carry so
 * {@link colorAreaDrag} can tell the horizontal-axis input from the
 * vertical-axis input. Set it alongside `type="range"` on both inputs the
 * mixin should coordinate.
 */
export const COLOR_AREA_AXIS_ATTRIBUTE = "data-color-area-axis";

/** {@link COLOR_AREA_AXIS_ATTRIBUTE} value the horizontal-axis input of a pair carries. */
export const COLOR_AREA_AXIS_X = "x";

/** {@link COLOR_AREA_AXIS_ATTRIBUTE} value the vertical-axis input of a pair carries. */
export const COLOR_AREA_AXIS_Y = "y";

/** DOM event type dispatched by {@link colorAreaDrag} on its host whenever a pointer gesture settles both paired axis inputs on new values. */
const COLOR_AREA_CHANGE_EVENT = "ui:color-area-change" as const;

declare global {
	interface HTMLElementEventMap {
		[COLOR_AREA_CHANGE_EVENT]: ColorAreaChangeEvent;
	}
}

/**
 * Dispatched on a ColorArea's host by {@link colorAreaDrag} whenever a
 * pointer gesture writes both paired axis inputs to new values together, so
 * a consumer can react to the settled pair — recomputing a swatch preview,
 * writing a combined value into a hidden field — without reading the two
 * `<input>` elements itself.
 */
export class ColorAreaChangeEvent extends Event {
	/** Settled value of the horizontal-axis input, after mapping the pointer position through its own `min`–`max` range. */
	readonly x: number;
	/** Settled value of the vertical-axis input, after mapping the pointer position through its own `min`–`max` range. */
	readonly y: number;

	/**
	 * @param init Settled horizontal- and vertical-axis values at dispatch time.
	 */
	constructor(init: Point) {
		super(COLOR_AREA_CHANGE_EVENT, { bubbles: true });
		this.x = init.x;
		this.y = init.y;
	}
}

/**
 * Reads one bound (`min` or `max`) off an axis input's own attribute value,
 * falling back to `fallback` when the attribute is unset — mirroring the
 * native `<input type="range">` defaults (`0` and `100`) an author gets when
 * omitting it.
 *
 * @param raw The input's own `min` or `max` property value.
 * @param fallback Bound to use when `raw` is unset.
 * @returns The parsed bound, or `fallback`.
 */
function readAxisBound(raw: string, fallback: number): number {
	if (raw === "") return fallback;

	let value = Number(raw);
	return Number.isFinite(value) ? value : fallback;
}

/**
 * Reads an axis input's own `min`–`max` range, defaulting each bound to the
 * native `<input type="range">` default (`0`–`100`) when the input omits it.
 *
 * @param input Axis input to read the range of.
 * @returns The input's own `min` and `max`, as numbers.
 */
function readAxisRange(input: HTMLInputElement): { min: number; max: number } {
	return { min: readAxisBound(input.min, 0), max: readAxisBound(input.max, 100) };
}

/**
 * Maps a normalized `[0, 1]` position onto `input`'s own `min`–`max` range.
 *
 * @param normalized Normalized position, `0`–`1`.
 * @param input Axis input whose own range the position maps onto.
 * @returns The mapped value, within `input`'s own `min`–`max` range.
 */
function mapToAxisValue(normalized: number, input: HTMLInputElement): number {
	let { min, max } = readAxisRange(input);
	return min + normalized * (max - min);
}

/**
 * Measures `point` against `host`'s own rectangle through
 * {@link normalizedPointerPosition}, maps the normalized position onto
 * `xInput`'s and `yInput`'s own ranges, writes both inputs' `valueAsNumber`
 * together, and dispatches {@link ColorAreaChangeEvent} on `host` with the
 * settled pair.
 *
 * The rectangle's vertical axis runs top-to-bottom, but a two-dimensional
 * picking surface's vertical channel conventionally increases toward the
 * top, so the normalized vertical position is inverted before it maps onto
 * `yInput`'s own range.
 *
 * @param host ColorArea root element the pointer position measures against.
 * @param xInput Horizontal-axis input to write.
 * @param yInput Vertical-axis input to write.
 * @param point Pointer position, in viewport coordinates.
 */
function applyPointerPosition(
	host: HTMLElement,
	xInput: HTMLInputElement,
	yInput: HTMLInputElement,
	point: Point,
): void {
	let rect = host.getBoundingClientRect();
	let normalized = normalizedPointerPosition(rect, point);

	let x = mapToAxisValue(normalized.x, xInput);
	let y = mapToAxisValue(1 - normalized.y, yInput);

	xInput.valueAsNumber = x;
	yInput.valueAsNumber = y;

	host.dispatchEvent(new ColorAreaChangeEvent({ x, y }));
}

/**
 * Adds pointer-driven, two-dimensional dragging to a ColorArea root. A
 * `pointerdown` from the primary pointer, pressed with the primary button,
 * captures the pointer against the root and immediately maps its position;
 * every subsequent `pointermove` while that pointer stays captured maps its
 * position again; `pointerup` and `pointercancel` release it. Only one
 * pointer is tracked at a time, so a second `pointerdown` while one is
 * already captured is ignored.
 *
 * Each mapped position is measured against the root's own rectangle through
 * {@link normalizedPointerPosition}, which clamps a pointer that has drifted
 * past the rectangle's edges to its border rather than losing the gesture,
 * then mapped onto the paired horizontal- and vertical-axis
 * `<input type="range">` elements' own `min`–`max` ranges — found under the
 * root through {@link COLOR_AREA_AXIS_ATTRIBUTE}, {@link COLOR_AREA_AXIS_X},
 * and {@link COLOR_AREA_AXIS_Y} — and written to both inputs'
 * `valueAsNumber` together, since one rectangle drag always moves both axes
 * at once and neither input can report the other's value on its own.
 *
 * Dispatches {@link ColorAreaChangeEvent} on the root every time a mapped
 * position settles both inputs.
 *
 * @returns A mixin descriptor for a ColorArea root's `mix` prop.
 * @example
 * <div mix={[colorAreaDrag(), css({ position: "relative" })]}>
 *   <input type="range" data-color-area-axis="x" min={0} max={100} defaultValue={50} />
 *   <input type="range" data-color-area-axis="y" min={0} max={100} defaultValue={50} />
 *   <span aria-hidden="true" mix={css({ position: "absolute" })} />
 * </div>
 */
export const colorAreaDrag: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let hostNode: HTMLElement | undefined;
	let activePointerId: number | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
		activePointerId = undefined;
	});

	return () =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "pointerdown">("pointerdown", (event) => {
					if (activePointerId !== undefined || !event.isPrimary || event.button !== 0) return;
					if (!hostNode) return;

					let inputs = findPairedRangeInputs(
						hostNode,
						COLOR_AREA_AXIS_ATTRIBUTE,
						COLOR_AREA_AXIS_X,
						COLOR_AREA_AXIS_Y,
					);
					if (!inputs) return;

					activePointerId = event.pointerId;
					hostNode.setPointerCapture(event.pointerId);
					applyPointerPosition(hostNode, inputs.a, inputs.b, {
						x: event.clientX,
						y: event.clientY,
					});
				}),
				on<HTMLElement, "pointermove">("pointermove", (event) => {
					if (event.pointerId !== activePointerId || !hostNode) return;

					let inputs = findPairedRangeInputs(
						hostNode,
						COLOR_AREA_AXIS_ATTRIBUTE,
						COLOR_AREA_AXIS_X,
						COLOR_AREA_AXIS_Y,
					);
					if (!inputs) return;

					applyPointerPosition(hostNode, inputs.a, inputs.b, {
						x: event.clientX,
						y: event.clientY,
					});
				}),
				on<HTMLElement, "pointerup">("pointerup", (event) => {
					if (event.pointerId !== activePointerId) return;
					activePointerId = undefined;
				}),
				on<HTMLElement, "pointercancel">("pointercancel", (event) => {
					if (event.pointerId !== activePointerId) return;
					activePointerId = undefined;
				}),
			],
		});
});
