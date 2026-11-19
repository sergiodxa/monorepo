/**
 * The player's gamepad map: each standard-mapping button pressed since the previous poll becomes
 * the player action it takes, so a controller drives the same actions as a mouse and keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gamepadPresses } from "@sdxc/ui/utils";

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
	let pressed = gamepadPresses(previous, current);
	return GAMEPAD_BUTTONS.filter(([index]) => pressed.includes(index)).map(([, action]) => action);
}
