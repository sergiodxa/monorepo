/**
 * Moves focus one control forward or back inside a container, wrapping at either end, for input
 * that has no Tab key: a gamepad's D-pad, a TV remote, a pair of arrow buttons. Only controls
 * a person can see and use take part, so a hidden or disabled one is passed over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Controls {@link moveFocus} visits, in document order. */
export const MOVE_FOCUS_SELECTOR =
	'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Focuses the next or previous visible control inside `root`, wrapping around. With focus
 * outside `root`, the first control takes it whichever way `step` points.
 *
 * @param root - The container to move through, such as a page region or an open dialog.
 * @param step - `1` for the next control, `-1` for the previous one.
 * @returns The control that took focus, or `null` when `root` has none.
 * @example moveFocus(dialog ?? main, button === 13 ? 1 : -1);
 */
export function moveFocus(root: Element, step: 1 | -1): HTMLElement | null {
	let controls = [...root.querySelectorAll<HTMLElement>(MOVE_FOCUS_SELECTOR)].filter(
		(control) => control.getClientRects().length > 0,
	);
	if (controls.length === 0) return null;
	let index = controls.indexOf(document.activeElement as HTMLElement);
	let next =
		index === -1 ? controls[0] : controls[(index + step + controls.length) % controls.length];
	next?.focus();
	return next ?? null;
}
