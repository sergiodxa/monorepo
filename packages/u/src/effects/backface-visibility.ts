/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type BackfaceVisibilityValue = "visible" | "hidden";

/**
 * Controls whether the back face of a 3D-transformed element is rendered
 * when it's rotated to face away from the viewer — `"hidden"` (the default)
 * is what a flip-card or page-turn effect needs so the reversed face
 * doesn't show through.
 *
 * @example u.backfaceVisibility()
 * @example css({ backfaceVisibility: "hidden" })
 */
export function backfaceVisibility<Node extends Element = Element>(
	value: BackfaceVisibilityValue = "hidden",
) {
	return utility<Node>(() => ({ backfaceVisibility: value }));
}
