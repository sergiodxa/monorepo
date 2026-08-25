/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type ObjectPositionValue =
	| "center"
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "top left"
	| "top right"
	| "bottom left"
	| "bottom right"
	| (string & {});

/**
 * Applies `object-position`, choosing which part of a replaced element's
 * cropped content stays visible, keeping a subject's face in frame once
 * `u.fit("cover")` crops it. Only works with `u.fit()` on replaced elements.
 *
 * @example u.objectPosition()
 * @example css({ objectPosition: "center" })
 * @example u.objectPosition("top")
 * @example css({ objectPosition: "top" })
 * @example u.objectPosition("50% 20%")
 * @example css({ objectPosition: "50% 20%" })
 */
export function objectPosition<Node extends Element = Element>(
	value: ObjectPositionValue = "center",
) {
	return utility<Node>(() => ({ objectPosition: value }));
}
