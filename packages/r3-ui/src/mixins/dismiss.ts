/**
 * Auto-dismiss behavior for a self-contained alert or notification host:
 * counts down a duration to dismissal, pausing the countdown while the
 * pointer hovers the host or focus rests somewhere inside it, and picking
 * back up from wherever it left off once both leave. Also answers the
 * `--ui-dismiss` invoker command from any trigger targeting the host,
 * dismissing right away regardless of the timer. Either path only ever
 * dispatches a `ui:dismiss` event on the host — removing the element from
 * the page, or from whatever queue produced it, is left to a listener the
 * consumer attaches to that event.
 *
 * Why JS: counting down to a dismissal, pausing that countdown while a
 * pointer or keyboard user is still attending to the content, and reacting
 * to a `--ui-dismiss` invoker command fired from a separate trigger element
 * all require script — no HTML attribute or CSS selector expresses "remove
 * this element after N paused-aware milliseconds".
 * No-JS baseline: the host renders and stays on the page for as long as the
 * page is open, fully readable and interactive; only the timed and
 * invoker-triggered dismissal are unavailable, so a host that must be
 * dismissible without JavaScript needs its own non-JS removal path (a form
 * submission, a full navigation) rather than relying on this mixin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { asCommandEvent } from "../utils/command-event";

/** Auto-dismiss delay, in milliseconds, {@link dismiss} uses when {@link Dismiss.Options.duration} is omitted. */
const DEFAULT_DURATION = 5000;

/** Invoker command {@link dismiss} answers on its host: any `commandfor` trigger button invoking it dismisses the host right away. */
const DISMISS_COMMAND = "--ui-dismiss" as const;

/** DOM event type dispatched on a host by {@link dismiss} whenever it dismisses, by timeout or by the invoker command. */
const DISMISS_EVENT = "ui:dismiss" as const;

declare global {
	interface HTMLElementEventMap {
		[DISMISS_EVENT]: DismissEvent;
	}
}

/**
 * Types associated with {@link dismiss}: the options it accepts and the
 * reasons it dismisses its host for.
 */
export namespace Dismiss {
	/** What triggered a dismissal: the auto-dismiss timer running out, or the `--ui-dismiss` invoker command firing. */
	export type Reason = "timeout" | "manual";

	/**
	 * Configuration accepted by {@link dismiss}.
	 */
	export interface Options {
		/**
		 * Milliseconds of visible, unpaused time before the host dismisses
		 * itself, or `null` to leave the timer disabled so the host only ever
		 * dismisses through the `--ui-dismiss` command. Defaults to 5000.
		 */
		duration?: number | null;
		/**
		 * Whether the countdown pauses while the pointer hovers the host or
		 * focus rests somewhere inside it, resuming from the time left once
		 * both leave. Defaults to `true`.
		 */
		pauseOnHover?: boolean;
	}
}

/**
 * Dispatched on a host by {@link dismiss} when it dismisses — either the
 * auto-dismiss timer running out or the `--ui-dismiss` command firing — so a
 * consumer can remove the host from the page, or from whatever queue
 * produced it, in response. The mixin itself never touches the DOM tree
 * beyond dispatching this event.
 */
export class DismissEvent extends Event {
	/** What triggered this dismissal. */
	readonly reason: Dismiss.Reason;

	/**
	 * @param reason What triggered this dismissal.
	 */
	constructor(reason: Dismiss.Reason) {
		super(DISMISS_EVENT, { bubbles: true, cancelable: true });
		this.reason = reason;
	}
}

/**
 * Adds an auto-dismiss countdown to an alert or notification host, pausing
 * it while the pointer hovers the host or focus rests inside it, and
 * answers the `--ui-dismiss` invoker command from any trigger targeting the
 * host — a close button needs nothing beyond
 * `<button commandfor={hostId} command="--ui-dismiss">`, no mixin or
 * hydration of its own.
 *
 * Neither path removes the host itself: both dispatch {@link DismissEvent}
 * on it, and the consuming island decides what dismissal means — removing
 * the element directly, or calling into whatever queue owns the surrounding
 * list of hosts.
 *
 * @param options Duration and hover-pause configuration; see {@link Dismiss.Options}.
 * @example
 * <div id="toast-1" role="status" mix={[dismiss({ duration: 4000 })]}>
 * 	Changes saved
 * 	<button commandfor="toast-1" command="--ui-dismiss">Close</button>
 * </div>
 * @example
 * // An Alert that only ever dismisses through its own close button.
 * <div id="banner" role="alert" mix={[dismiss({ duration: null })]}>
 * 	Your session expires soon.
 * 	<button commandfor="banner" command="--ui-dismiss">Dismiss</button>
 * </div>
 */
export const dismiss: MixinFactory<HTMLElement, [options?: Dismiss.Options], ElementProps> =
	createMixin<HTMLElement, [options?: Dismiss.Options], ElementProps>((handle) => {
		let hostNode: HTMLElement | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let duration: number | null = null;
		let remaining = 0;
		let startedAt: number | null = null;
		let pointerInside = false;
		let focusInside = false;
		let initialized = false;

		handle.addEventListener("insert", (event) => {
			hostNode = event.node;
		});
		handle.addEventListener("remove", () => {
			clearTimer();
			hostNode = undefined;
		});

		/** Clears the pending timeout, if any, without touching `startedAt` or `remaining`. */
		function clearTimer(): void {
			if (timer === undefined) return;
			clearTimeout(timer);
			timer = undefined;
		}

		/** Dispatches {@link DismissEvent} on the host for `reason` and clears any pending timer. */
		function fire(reason: Dismiss.Reason): void {
			clearTimer();
			startedAt = null;
			hostNode?.dispatchEvent(new DismissEvent(reason));
		}

		/** Starts (or restarts) the timeout counting down whatever time is left in `remaining`. */
		function scheduleRemaining(): void {
			clearTimer();
			startedAt = Date.now();
			timer = setTimeout(() => fire("timeout"), remaining);
		}

		/** Pauses the countdown, recording how much time was left. A no-op when no timer is currently running. */
		function pauseTimer(): void {
			if (duration === null || startedAt === null) return;
			remaining = Math.max(0, remaining - (Date.now() - startedAt));
			clearTimer();
			startedAt = null;
		}

		/** Resumes the countdown from the time left, unless the pointer or focus is still inside the host. */
		function resumeTimer(): void {
			if (duration === null || startedAt !== null) return;
			if (pointerInside || focusInside) return;
			scheduleRemaining();
		}

		return (options = {}, props = options as ElementProps) => {
			// `options` is optional, so a call site that omits it (`dismiss()`)
			// gets the runtime's trailing current-props argument in its place —
			// reset it back to an empty options object when that happens.
			if (props === options) {
				options = {};
			}

			let pauseOnHover = options.pauseOnHover ?? true;

			if (!initialized) {
				initialized = true;
				duration = options.duration === undefined ? DEFAULT_DURATION : options.duration;

				if (duration !== null) {
					remaining = duration;
					scheduleRemaining();
				}
			}

			return createElement(handle.element, {
				mix: [
					on<HTMLElement, "pointerenter">("pointerenter", () => {
						pointerInside = true;
						if (pauseOnHover) pauseTimer();
					}),
					on<HTMLElement, "pointerleave">("pointerleave", () => {
						pointerInside = false;
						if (pauseOnHover) resumeTimer();
					}),
					on<HTMLElement, "focusin">("focusin", () => {
						focusInside = true;
						if (pauseOnHover) pauseTimer();
					}),
					on<HTMLElement, "focusout">("focusout", (event) => {
						let related = event.relatedTarget;
						if (related instanceof Node && event.currentTarget.contains(related)) return;

						focusInside = false;
						if (pauseOnHover) resumeTimer();
					}),
					on<HTMLElement, "command">("command", (event) => {
						if (asCommandEvent(event).command !== DISMISS_COMMAND) return;
						fire("manual");
					}),
				],
			});
		};
	});
