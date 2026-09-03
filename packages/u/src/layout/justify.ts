/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** Accepted `justify-content`/`align-content` keywords, shared with `u.content()`. */
export type JustifyValue = "start" | "center" | "end" | "between" | "around" | "evenly";

const JUSTIFY_ALIASES: Record<string, string> = {
	between: "space-between",
	around: "space-around",
	evenly: "space-evenly",
};

/** Resolves a {@link JustifyValue} to its CSS keyword, aliasing `between`/`around`/`evenly` to their `space-*` form. */
export function resolveJustify(value: JustifyValue): string {
	return JUSTIFY_ALIASES[value] ?? value;
}

/**
 * Sets `justify-content`, aliasing the short `between`/`around`/`evenly`
 * forms to their `space-*` CSS keywords.
 *
 * @example u.justify("between")
 * @example css({ justifyContent: "space-between" })
 * @example u.justify("center")
 * @example css({ justifyContent: "center" })
 */
export function justify<Node extends Element = Element>(value: JustifyValue = "start") {
	return utility<Node>(() => ({ justifyContent: resolveJustify(value) }));
}
