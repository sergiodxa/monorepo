/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { FontFamilyName } from "../types";

import { utility } from "../internal/descriptor";
import { font as fontToken } from "../internal/tokens";

/**
 * Applies `font-family` from the named font-family scale
 * (`sans`, `serif`, `mono`, or an app-extended name), resolving through
 * `var(--ui-font-{name}, fallback)` so the family works before an app ever
 * defines the variable. The literal keywords `"inherit"` and `"unset"` pass
 * through unchanged instead of being mistaken for an app-extensible token
 * name and `var()`-wrapped — mirrors the same literal-passthrough escape
 * `radius()`/`text()`/`container()`/`blur()` already have for a raw length.
 *
 * @example u.font("serif")
 * @example css({ fontFamily: "var(--ui-font-serif, ui-serif, Georgia, serif)" })
 * @example u.font("inherit")
 * @example css({ fontFamily: "inherit" })
 */
export function font<Node extends Element = Element>(name: FontFamilyName | (string & {})) {
	return utility<Node>(() => ({
		fontFamily: name === "inherit" || name === "unset" ? name : fontToken(name),
	}));
}
