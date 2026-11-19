/**
 * Input beyond the keyboard map: a gamepad read as edges (a button counts once per press), focus
 * moved through the player's controls by the D-pad, and a swipe told apart from a tap, so a
 * controller and a touch screen drive the same actions as a mouse and keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** What a gamepad press does in the player. */
export type GamepadAction =
	| "activate"
	| "back"
	| "rollback"
	| "skip"
	| "settings"
	| "focus-next"
	| "focus-previous";

/** Standard-mapping buttons and the action each one takes. */
const GAMEPAD_BUTTONS: ReadonlyArray<readonly [number, GamepadAction]> = [
	[0, "activate"],
	[1, "back"],
	[4, "rollback"],
	[5, "skip"],
	[9, "settings"],
	[12, "focus-previous"],
	[14, "focus-previous"],
	[13, "focus-next"],
	[15, "focus-next"],
];

/**
 * The actions of the buttons pressed since the previous poll.
 *
 * @param previous - Which buttons were down at the previous poll.
 * @param current - Which buttons are down now.
 * @returns One action per newly pressed button, in button order.
 * @example gamepadActions([false], [true]); // ["activate"]
 */
export function gamepadActions(
	previous: readonly boolean[],
	current: readonly boolean[],
): GamepadAction[] {
	return GAMEPAD_BUTTONS.filter(
		([index]) => current[index] === true && previous[index] !== true,
	).map(([, action]) => action);
}

/** Controls a gamepad or arrow key can focus. */
const FOCUSABLE =
	'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus to the next or previous control inside `root`, wrapping around; with nothing
 * focused inside it, the first control takes focus.
 *
 * @param root - The player, or the dialog open in it.
 * @param step - `1` for the next control, `-1` for the previous one.
 * @returns The control that took focus, or `null` when `root` has none.
 */
export function moveFocus(root: Element, step: 1 | -1): HTMLElement | null {
	let controls = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
		(control) => control.getClientRects().length > 0,
	);
	if (controls.length === 0) return null;
	let index = controls.indexOf(document.activeElement as HTMLElement);
	let next =
		index === -1 ? controls[0] : controls[(index + step + controls.length) % controls.length];
	next?.focus();
	return next ?? null;
}

/** How far a pointer travels before a press counts as a swipe instead of a tap. */
export const SWIPE_DISTANCE = 48;

/**
 * Reads a pointer's travel as a swipe.
 *
 * @param dx - Horizontal travel in pixels, positive to the right.
 * @param dy - Vertical travel in pixels, positive downward.
 * @returns The swipe's direction, or `null` for a tap.
 */
export function swipeDirection(dx: number, dy: number): "up" | "down" | "left" | "right" | null {
	if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return null;
	if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? "down" : "up";
	return dx > 0 ? "right" : "left";
}
