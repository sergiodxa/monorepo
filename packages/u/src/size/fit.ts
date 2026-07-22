/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type FitValue = "cover" | "contain" | "fill" | "none" | "scale-down";

/**
 * Applies `object-fit`, for media elements (`img`, `video`) sized by their
 * container rather than their intrinsic dimensions.
 *
 * @example u.fit("cover")
 * @example css({ objectFit: "cover" })
 */
export function fit<Node extends Element = Element>(value: FitValue = "cover") {
	return utility<Node>(() => ({ objectFit: value }));
}
