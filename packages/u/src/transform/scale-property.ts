/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets the standalone `scale` CSS property directly — distinct from
 * `u.scale()`, which sets the `scale(...)` *transform function* through the
 * additive `transform`-composition mechanism (see `internal/transform.ts`).
 * `scale` is its own independent CSS property, so a single utility call is
 * enough: it isn't part of that composition system and always overwrites
 * outright, which matches how it's actually used (at most one `scale` value
 * active on a given element at a time).
 *
 * @example u.scaleProperty(0.95)
 * @example css({ scale: "0.95" })
 * @example u.scaleProperty("none")
 * @example css({ scale: "none" })
 */
export function scaleProperty<Node extends Element = Element>(value: number | (string & {})) {
	return utility<Node>(() => ({ scale: typeof value === "number" ? String(value) : value }));
}
