/**
 * Generic long-press detection for any host element: a `pointerdown` starts
 * a timer, and once the pointer has held still for a configurable duration,
 * the host dispatches a namespaced `ui:long-press` event carrying the
 * pointer's position, so a consumer can anchor a menu, tooltip, or preview
 * to the exact spot the press held.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";
import type { AnchorPoint } from "remix/ui/anchor";

import { createElement, createMixin, on } from "remix/ui";

import { isNewPrimaryPress } from "../utils/is-new-primary-press";

/** Duration, in milliseconds, {@link longPress} holds the pointer for before dispatching, when {@link LongPress.Options.duration} is omitted. */
const DEFAULT_DURATION = 500;

/**
 * Distance, in pixels, the pointer may drift from its `pointerdown` position
 * before {@link longPress} clears the pending timer instead of letting it
 * fire, tolerating the small, involuntary movement a held press carries.
 */
const MOVE_TOLERANCE = 10;

/** DOM event type dispatched on the host by {@link longPress} once a press holds still for the configured duration. */
const LONG_PRESS_EVENT = "ui:long-press" as const;

declare global {
	interface HTMLElementEventMap {
		[LONG_PRESS_EVENT]: LongPressEvent;
	}
}

/**
 * Types associated with {@link longPress}: the options it accepts.
 */
export namespace LongPress {
	/**
	 * Configuration accepted by {@link longPress}.
	 */
	export interface Options {
		/**
		 * Milliseconds the pointer must remain pressed, without drifting past
		 * the movement tolerance, before {@link LongPressEvent} fires. Defaults
		 * to 500.
		 */
		duration?: number;
	}
}

/**
 * Dispatched on a host by {@link longPress} once a pointer press has held
 * its position for the configured duration, carrying that position as an
 * `AnchorPoint` so a consumer can anchor a menu, tooltip, or preview to it.
 */
export class LongPressEvent extends Event {
	/** Pointer position the press held, in viewport coordinates, ready to pass straight into `remix/ui/anchor`'s point-based anchoring. */
	readonly point: AnchorPoint;

	/**
	 * @param point Pointer position the press held.
	 */
	constructor(point: AnchorPoint) {
		super(LONG_PRESS_EVENT, { bubbles: true });
		this.point = point;
	}
}

/**
 * Detects a long press on any host element: a primary-pointer `pointerdown`
 * starts a timer, tracking only one press at a time, and dispatches
 * {@link LongPressEvent} once the pointer holds still for the full duration.
 *
 * @param options Duration configuration; see {@link LongPress.Options}.
 * Reset to an empty object when the mixin runtime passes its trailing
 * current-props argument in its place.
 * @returns A mixin descriptor for a host element's `mix` prop.
 * @example
 * <li
 * 	id="row-1"
 * 	mix={[
 * 		longPress(),
 * 		on("ui:long-press", (event) => {
 * 			let menu = document.getElementById("row-1-menu");
 * 			if (!menu) return;
 * 			anchor(menu, event.point);
 * 			menu.showPopover();
 * 		}),
 * 	]}
 * >
 * 	Row 1
 * </li>
 * <div id="row-1-menu" popover="auto" role="menu">...</div>
 */
export const longPress: MixinFactory<HTMLElement, [options?: LongPress.Options], ElementProps> =
	createMixin<HTMLElement, [options?: LongPress.Options], ElementProps>((handle) => {
		let hostNode: HTMLElement | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let activePointerId: number | undefined;
		let origin: AnchorPoint | undefined;

		handle.addEventListener("insert", (event) => {
			hostNode = event.node;
		});
		handle.addEventListener("remove", () => {
			clearPending();
			hostNode = undefined;
		});

		/** Clears the pending timer, if any, and forgets the tracked pointer and its origin. */
		function clearPending(): void {
			if (timer !== undefined) {
				clearTimeout(timer);
				timer = undefined;
			}
			activePointerId = undefined;
			origin = undefined;
		}

		return (options = {}, props = options as ElementProps) => {
			if (props === options) {
				options = {};
			}

			let duration = options.duration ?? DEFAULT_DURATION;

			return createElement(handle.element, {
				mix: [
					on<HTMLElement, "pointerdown">("pointerdown", (event) => {
						if (!isNewPrimaryPress(event, activePointerId)) return;

						activePointerId = event.pointerId;
						origin = { x: event.clientX, y: event.clientY };

						timer = setTimeout(() => {
							let point = origin;
							clearPending();
							if (point) hostNode?.dispatchEvent(new LongPressEvent(point));
						}, duration);
					}),
					on<HTMLElement, "pointermove">("pointermove", (event) => {
						if (event.pointerId !== activePointerId || !origin) return;

						let distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
						if (distance > MOVE_TOLERANCE) clearPending();
					}),
					on<HTMLElement, "pointerup">("pointerup", (event) => {
						if (event.pointerId !== activePointerId) return;
						clearPending();
					}),
					on<HTMLElement, "pointercancel">("pointercancel", (event) => {
						if (event.pointerId !== activePointerId) return;
						clearPending();
					}),
					on<HTMLElement, "pointerleave">("pointerleave", (event) => {
						if (event.pointerId !== activePointerId) return;
						clearPending();
					}),
				],
			});
		};
	});
