/**
 * Drags a ColorArea root as one two-dimensional pointer gesture, mapping the
 * pointer position onto paired horizontal- and vertical-axis range inputs
 * and writing both together — the one update neither input's own drag
 * handling can produce alone, since each tracks only its own axis.
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
 * vertical-axis input.
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
 * pointer gesture settles both paired axis inputs on new values, so a
 * consumer can react to the pair without reading the two `<input>` elements itself.
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
 * native `<input type="range">` defaults an author gets when omitting it.
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
 * Measures `point` against `host`'s own rectangle, maps the position onto
 * `xInput`'s and `yInput`'s own ranges — inverting the vertical position
 * since a picking surface's vertical channel increases upward while the
 * rectangle's runs top-to-bottom — and dispatches {@link ColorAreaChangeEvent} on `host`.
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
 * Adds pointer-driven, two-dimensional dragging to a ColorArea root,
 * mapping each captured pointer's position onto the paired axis inputs
 * found via {@link COLOR_AREA_AXIS_ATTRIBUTE} and dispatching {@link ColorAreaChangeEvent} on settled pairs.
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
