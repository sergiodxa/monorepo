/**
 * Reads a gamepad's buttons as presses: polled once per frame, a held button would act on every
 * frame, so comparing two polls reports each button once, on the frame it goes down, the way a
 * key press reports once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The buttons pressed since the previous poll.
 *
 * @param previous - Which buttons were down at the previous poll, by index; empty on the first.
 * @param current - Which buttons are down now, by index.
 * @returns The index of every button that went down, ascending; with the browser's standard
 * mapping, `0` is the bottom face button and `12`–`15` the D-pad (up, down, left, right).
 * @example
 * let down = pad.buttons.map((button) => button.pressed);
 * for (let index of gamepadPresses(last, down)) act(index);
 * last = down;
 */
export function gamepadPresses(
	previous: readonly boolean[],
	current: readonly boolean[],
): number[] {
	let pressed: number[] = [];
	for (let index = 0; index < current.length; index++) {
		if (current[index] === true && previous[index] !== true) pressed.push(index);
	}
	return pressed;
}
