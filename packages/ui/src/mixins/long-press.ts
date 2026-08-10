/**
 * Generic long-press detection for any host element: a `pointerdown` starts
 * a timer, and once the pointer has held its position for a configurable
 * duration, the host dispatches a namespaced `ui:long-press` event carrying
 * the pointer's position — the same `x`/`y` pair `contextMenu()` anchors its
 * own point-based surface to — so a consumer can anchor a menu, tooltip, or
 * preview to the exact spot the press held. The pointer lifting,
 * cancelling, leaving the host, or drifting past a small movement tolerance
 * before the duration elapses all clear the pending timer first, so only a
 * held, mostly-still press ever fires.
 *
 * Why JS: no HTML attribute or CSS selector recognizes "the pointer has
 * remained pressed in roughly the same spot for N milliseconds" — only a
 * timer started on `pointerdown` and cleared on release, cancellation, or
 * movement can measure that duration and confirm the press held still long
 * enough.
 * No-JS baseline: none, mirroring `contextMenu()`'s own baseline — a tap or
 * click still reaches the host and fires its ordinary behavior; without
 * this mixin, holding the pointer down simply does nothing extra.
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
 * fire — a fixed tolerance for the small, involuntary movement a held press
 * naturally carries, not a deliberate drag.
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
 * Dispatched on a host by {@link longPress} once a pointer press has held its
 * position for the configured duration, carrying the pointer's position as
 * an `AnchorPoint` so a consumer can anchor a point-based surface — a menu,
 * a tooltip, a preview — to the exact spot the press held, the same
 * technique `contextMenu()` uses for its own point-anchored surface.
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
 * Detects a long press on any host element. A `pointerdown` from the primary
 * pointer, pressed with the primary button, records the pointer's position
 * and starts a timer for `options.duration` milliseconds; only one press is
 * tracked at a time, so a second `pointerdown` while one is already pending
 * is ignored.
 *
 * `pointerup`, `pointercancel`, `pointerleave`, or the pointer drifting past
 * a small movement tolerance from where it first pressed all clear the
 * pending timer before it fires, so a dragged, released, or otherwise
 * interrupted press never dispatches an event — an ordinary tap or click
 * still reaches the host and behaves exactly as it would without this
 * mixin. A press that holds still for the full duration dispatches
 * {@link LongPressEvent} on the host, carrying the position the pointer
 * pressed at.
 *
 * @param options Duration configuration; see {@link LongPress.Options}.
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
			// `options` is optional, so a call site that omits it
			// (`longPress()`) gets the runtime's trailing current-props argument
			// in its place — reset it back to an empty options object when that
			// happens.
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
