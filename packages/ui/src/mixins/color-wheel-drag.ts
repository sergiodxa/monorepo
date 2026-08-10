/**
 * Reshapes a ColorWheel's underlying hue input into a ring the moment it
 * attaches, then drags the root as a single angular gesture: a `pointerdown`
 * anywhere on the ring captures the pointer, and every `pointermove` while
 * that pointer stays captured measures its clockwise angle around the root's
 * own center, converts that angle to a hue, and writes the hue input's
 * `valueAsNumber` — the one update the input's own linear drag handling can't
 * produce alone, since its native thumb only ever tracks a straight track,
 * never an angle around a point.
 *
 * Shares its angle math — {@link angleFromCenter}, {@link angleToHue} — with
 * `colorAreaDrag()` through `color-math.ts`, but keeps its own pointer wiring
 * separate from that mixin's: measuring an angle around a center point and
 * driving one input is a different shape of problem than clamping a position
 * inside a rectangle and driving two, and merging the two into one mixin
 * would only complicate both — the same reasoning that keeps `resizeHandle()`
 * and `dualRange()` as two mixins covering two different shapes of drag
 * instead of one covering both.
 *
 * Why JS: a native `<input type="range">` reports a pointer drag along its
 * own single axis only; nothing in HTML or CSS measures a pointer's angle
 * around a center point, or reshapes a track already laid out as a straight
 * bar into a ring in the first place.
 * No-JS baseline: the hue input still renders as a real, independent
 * `<input type="range">` a screen reader announces and a keyboard drives with
 * its own arrow keys, and it still posts its value with the form; only the
 * ring shape, dragging around it as one gesture, and the settled change
 * notification are unavailable.
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
 * {@link COLOR_WHEEL_SHAPE_CIRCULAR} on its host the moment it attaches.
 * ColorWheel's own `css()` styling keys off this same attribute to repaint
 * its default linear track as a ring — the mixin only ever flips the flag;
 * the shape change itself lives entirely in that static styling, the same
 * "mixin flips a data-* flag, static CSS does the rest" technique
 * `imageFallback()` uses for its own fallback attribute.
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
 * consumer can react to the settled hue — recomputing a swatch preview,
 * writing a combined value into a hidden field — without reading the
 * `<input>` element itself.
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
 * {@link angleFromCenter} measures a pointer's position against, so the same
 * angle reads correctly regardless of where the ring sits on the page or how
 * large it renders.
 *
 * @param host ColorWheel root element to measure.
 * @returns The center point, in viewport coordinates.
 */
function measureCenter(host: HTMLElement): Point {
	let rect = host.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Measures `point` as a clockwise angle around `host`'s own center through
 * {@link angleFromCenter}, converts that angle to a hue through
 * {@link angleToHue}, writes the rounded result onto `hueInput.valueAsNumber`,
 * and dispatches {@link ColorWheelChangeEvent} on `host` with the settled
 * hue.
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
 * Adds pointer-driven, angular dragging to a ColorWheel root. On attach, sets
 * {@link COLOR_WHEEL_SHAPE_ATTRIBUTE} to {@link COLOR_WHEEL_SHAPE_CIRCULAR}
 * on the host, so its own static styling repaints its default linear track
 * as a ring.
 *
 * A `pointerdown` from the primary pointer, pressed with the primary button,
 * captures the pointer against the root and immediately measures its
 * position; every subsequent `pointermove` while that pointer stays captured
 * measures its position again; `pointerup` and `pointercancel` release it.
 * Only one pointer is tracked at a time, so a second `pointerdown` while one
 * is already captured is ignored.
 *
 * Each measured position is read as a clockwise angle around the root's own
 * center through {@link angleFromCenter}, converted to a hue through
 * {@link angleToHue}, and written onto the underlying hue input's
 * `valueAsNumber` — found beneath the root through {@link findHueInput} —
 * since a native range input's own drag handling only ever tracks a position
 * along its single axis, never an angle around a point.
 *
 * Dispatches {@link ColorWheelChangeEvent} on the root every time a measured
 * position settles the hue input on a new value.
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
