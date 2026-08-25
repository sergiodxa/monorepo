/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets the standalone `scale` CSS property directly — distinct from
 * `u.scale()`, which sets the `scale(...)` transform function through the
 * composable `transform` mechanism; overwrites outright, matching its use.
 *
 * @example u.scaleProperty(0.95)
 * @example css({ scale: "0.95" })
 * @example u.scaleProperty("none")
 * @example css({ scale: "none" })
 */
export function scaleProperty<Node extends Element = Element>(value: number | (string & {})) {
	return utility<Node>(() => ({ scale: typeof value === "number" ? String(value) : value }));
}
