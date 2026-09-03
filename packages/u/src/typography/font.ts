/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { FontFamilyName } from "../types.js";

import { utility } from "../internal/descriptor.js";
import { font as fontToken } from "../internal/tokens.js";

/**
 * Applies `font-family` from the named font scale (`sans`, `serif`, `mono`,
 * or an app-extended name) via `var(--ui-font-{name}, fallback)`.
 * `"inherit"` and `"unset"` pass through unchanged as literal CSS keywords.
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
