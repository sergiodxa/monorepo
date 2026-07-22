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
 * defines the variable.
 *
 * @example u.font("serif")
 * @example css({ fontFamily: "var(--ui-font-serif, ui-serif, Georgia, serif)" })
 */
export function font<Node extends Element = Element>(name: FontFamilyName | (string & {})) {
	return utility<Node>(() => ({ fontFamily: fontToken(name) }));
}
