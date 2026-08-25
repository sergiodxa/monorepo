/**
 * The `pointerdown` guard every pointer-tracking mixin evaluates before it
 * starts a gesture: a press only begins tracking when no other pointer is
 * already mid-gesture, the event's own pointer is the primary one for its
 * type, and it was pressed with the primary button — the same three
 * conditions a long-press timer and a resize-handle drag each confirm first,
 * so a secondary pointer, a non-primary button, or a press arriving while
 * another is already tracked all leave the existing gesture alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Confirms a `pointerdown` event starts a fresh primary press:
 * `activePointerId` holds `undefined`, `event.isPrimary` is `true`, and
 * `event.button` is `0`.
 *
 * @param event The `pointerdown` event to evaluate.
 * @param activePointerId The pointer id the caller currently tracks, or
 * `undefined` when it tracks none.
 * @returns Whether `event` starts a fresh primary press the caller should
 * begin tracking.
 * @example
 * on<HTMLElement, "pointerdown">("pointerdown", (event) => {
 *   if (!isNewPrimaryPress(event, activePointerId)) return;
 *   activePointerId = event.pointerId;
 * });
 */
export function isNewPrimaryPress(
	event: Pick<PointerEvent, "isPrimary" | "button">,
	activePointerId: number | undefined,
): boolean {
	return activePointerId === undefined && event.isPrimary && event.button === 0;
}
