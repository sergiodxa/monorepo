/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** The accepted `transform-style` values. */
export type TransformStyleValue = "flat" | "preserve-3d";

/**
 * Sets the standalone `transform-style` property outright on the **parent** of
 * 3D-transformed children, since CSS defaults to `flat`; an `overflow`, `filter`,
 * `mask`, or opacity below 1 on the element silently forces it back to `flat`.
 *
 * @example u.transformStyle()
 * @example css({ transformStyle: "preserve-3d" })
 * @example u.transformStyle("flat")
 * @example css({ transformStyle: "flat" })
 */
export function transformStyle<Node extends Element = Element>(
	value: TransformStyleValue = "preserve-3d",
) {
	return utility<Node>(() => ({ transformStyle: value }));
}
