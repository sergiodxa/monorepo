/**
 * Ties a drawn toast stack to its `Toaster` queue: hovering or focusing the
 * region holds every timer, a toast's native `close` leaves the queue, and an
 * action runs once and takes its toast away.
 *
 * Why JS: timers and the queue live in script. No-JS baseline: a server-rendered
 * toast stays until its close button's native `close` command hides it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/component";

import type { Toaster } from "../behaviors/toaster.js";

/**
 * Pauses every toast in `toaster` while the pointer or focus rests on the
 * region, and resumes once both leave, so a fanned-out stack stays readable.
 *
 * @example
 * <div data-slot="region" mix={[toastHold(toaster)]}>{toasts}</div>
 */
export const toastHold = createMixin<HTMLElement, [toaster: Toaster<unknown>]>((handle) => {
	let pointerInside = false;
	let focusInside = false;

	/** Pauses while either the pointer or focus is inside, resumes otherwise. */
	function hold(toaster: Toaster<unknown>): void {
		if (pointerInside || focusInside) toaster.pause();
		else toaster.resume();
	}

	return (toaster) =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "pointerenter">("pointerenter", () => {
					pointerInside = true;
					hold(toaster);
				}),
				on<HTMLElement, "pointerleave">("pointerleave", () => {
					pointerInside = false;
					hold(toaster);
				}),
				on<HTMLElement, "focusin">("focusin", () => {
					focusInside = true;
					hold(toaster);
				}),
				on<HTMLElement, "focusout">("focusout", (event) => {
					let next = event.relatedTarget;
					focusInside = next instanceof Node && event.currentTarget.contains(next);
					hold(toaster);
				}),
			],
		});
});

/**
 * Removes toast `id` from `toaster` when its `<dialog>` host closes, which its
 * close button does natively through the `close` command.
 *
 * @example
 * <dialog open id="toast-1" mix={[toastClose(toaster, "1")]}>…</dialog>
 */
export const toastClose = createMixin<HTMLDialogElement, [toaster: Toaster<unknown>, id: string]>(
	(handle) => (toaster, id) =>
		createElement(handle.element, {
			mix: [on<HTMLDialogElement, "close">("close", () => void toaster.dismiss(id))],
		}),
);

/**
 * Runs a toast action's callback on click; unless the button submits a form,
 * whose navigation carries on, toast `id` then leaves `toaster`.
 *
 * @example
 * <button mix={[toastAction(toaster, id, restore)]}>Undo</button>
 */
export const toastAction = createMixin<
	HTMLButtonElement,
	[toaster: Toaster<unknown>, id: string, onAction: (() => void) | undefined]
>(
	(handle) => (toaster, id, onAction) =>
		createElement(handle.element, {
			mix: [
				on<HTMLButtonElement, "click">("click", (event) => {
					onAction?.();
					if (event.currentTarget.type !== "submit") toaster.dismiss(id);
				}),
			],
		}),
);
