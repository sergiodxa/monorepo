/**
 * Reshapes a ColorWheel's underlying hue input into a ring the moment it
 * attaches, then drags the root as one angular gesture: measures the
 * pointer's clockwise angle around the root's center, converts it to a hue,
 * and writes the hue input's `valueAsNumber`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import type { Point } from "../utils/color-math";

import { angleFromCenter, angleToHue, roundChannel } from "../utils/color-math";

/**
 * `data-*` attribute {@link colorWheelDrag} sets to
 * {@link COLOR_WHEEL_SHAPE_CIRCULAR} on its host the moment it attaches, so
 * ColorWheel's own static `css()` styling repaints its track as a ring.
 */
export const COLOR_WHEEL_SHAPE_ATTRIBUTE = "data-shape";

/**
 * Value {@link colorWheelDrag} writes to {@link COLOR_WHEEL_SHAPE_ATTRIBUTE}
 * on attach.
 */
export const COLOR_WHEEL_SHAPE_CIRCULAR = "circular";

/** DOM event type dispatched by {@link colorWheelDrag} on its host whenever a pointer gesture writes the underlying hue input to a new value. */
const COLOR_WHEEL_CHANGE_EVENT = "ui:color-wheel-change" as const;

declare global {
	interface HTMLElementEventMap {
		[COLOR_WHEEL_CHANGE_EVENT]: ColorWheelChangeEvent;
	}
}

/**
 * Dispatched on a ColorWheel's host by {@link colorWheelDrag} whenever a
 * pointer gesture writes the underlying hue input to a new value, so a
 * consumer can react to the settled hue without reading the `<input>` itself.
 */
export class ColorWheelChangeEvent extends Event {
	/** Settled hue, in degrees, `0`–`360`, after mapping the pointer's angle through {@link angleToHue}. */
	readonly hue: number;

	/**
	 * @param hue Settled hue value at dispatch time.
	 */
	constructor(hue: number) {
		super(COLOR_WHEEL_CHANGE_EVENT, { bubbles: true });
		this.hue = hue;
	}
}

/**
 * Finds the single native range input a ColorWheel renders for its hue value
 * — the one input {@link colorWheelDrag} writes on every pointer gesture.
 *
 * @param host ColorWheel root element the mixin is applied to.
 * @returns The matched hue input, or `undefined` when none is found.
 */
function findHueInput(host: HTMLElement): HTMLInputElement | undefined {
	return host.querySelector<HTMLInputElement>('input[type="range"]') ?? undefined;
}

/**
 * Measures `host`'s own center point in viewport coordinates — the origin
 * {@link angleFromCenter} measures a pointer's position against, so the
 * angle reads correctly regardless of where or how large the ring renders.
 *
 * @param host ColorWheel root element to measure.
 * @returns The center point, in viewport coordinates.
 */
function measureCenter(host: HTMLElement): Point {
	let rect = host.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Measures `point` as a clockwise angle around `host`'s own center, converts
 * it to a hue through {@link angleToHue}, writes the rounded result onto
 * `hueInput.valueAsNumber`, and dispatches {@link ColorWheelChangeEvent} on `host`.
 *
 * @param host ColorWheel root element the pointer position measures against.
 * @param hueInput The wheel's underlying hue input to write.
 * @param point Pointer position, in viewport coordinates.
 */
function applyPointerHue(host: HTMLElement, hueInput: HTMLInputElement, point: Point): void {
	let center = measureCenter(host);
	let angle = angleFromCenter(center, point);
	let hue = roundChannel(angleToHue(angle));

	hueInput.valueAsNumber = hue;
	host.dispatchEvent(new ColorWheelChangeEvent(hue));
}

/**
 * Adds pointer-driven, angular dragging to a ColorWheel root, reshaping its
 * hue input into a ring via {@link COLOR_WHEEL_SHAPE_ATTRIBUTE}, then mapping
 * each captured pointer's angle to a hue and dispatching {@link ColorWheelChangeEvent} on settled values.
 *
 * @returns A mixin descriptor for a ColorWheel root's `mix` prop.
 * @example
 * <div
 * 	role="group"
 * 	aria-label={hueLabel}
 * 	mix={[colorWheelDrag(), css({ position: "relative" })]}
 * >
 * 	<input type="range" min={0} max={360} step={1} defaultValue={0} aria-label={hueLabel} />
 * </div>
 */
export const colorWheelDrag: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let hostNode: HTMLElement | undefined;
	let activePointerId: number | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
		hostNode.setAttribute(COLOR_WHEEL_SHAPE_ATTRIBUTE, COLOR_WHEEL_SHAPE_CIRCULAR);
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

					let hueInput = findHueInput(hostNode);
					if (!hueInput) return;

					activePointerId = event.pointerId;
					hostNode.setPointerCapture(event.pointerId);
					applyPointerHue(hostNode, hueInput, { x: event.clientX, y: event.clientY });
				}),
				on<HTMLElement, "pointermove">("pointermove", (event) => {
					if (event.pointerId !== activePointerId || !hostNode) return;

					let hueInput = findHueInput(hostNode);
					if (!hueInput) return;

					applyPointerHue(hostNode, hueInput, { x: event.clientX, y: event.clientY });
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
