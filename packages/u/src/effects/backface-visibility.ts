/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type BackfaceVisibilityValue = "visible" | "hidden";

/**
 * Controls whether the back face of a 3D-transformed element renders once it
 * rotates away from the viewer; the `"hidden"` default keeps flip-card and
 * page-turn effects showing only their front face.
 *
 * @example u.backfaceVisibility()
 * @example css({ backfaceVisibility: "hidden" })
 */
export function backfaceVisibility<Node extends Element = Element>(
	value: BackfaceVisibilityValue = "hidden",
) {
	return utility<Node>(() => ({ backfaceVisibility: value }));
}
