/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * `"light dark"` and `"dark light"` both declare support for both schemes; the
 * order is a preference hint used when the user has expressed none. The
 * `"only "` prefix pins a scheme and renders it exactly as authored.
 */
export type ColorSchemeValue =
	| "light"
	| "dark"
	| "light dark"
	| "dark light"
	| "normal"
	| "only light"
	| "only dark"
	| (string & {});

/**
 * Sets `color-scheme`, which tells the browser which schemes an element
 * renders correctly in, so the chrome the browser paints itself — scrollbars,
 * pickers, form controls — follows the theme. It inherits: set it on `<html>`.
 *
 * @example u.colorScheme()
 * @example css({ colorScheme: "light dark" })
 * @example u.colorScheme("dark")
 * @example css({ colorScheme: "dark" })
 * @example u.colorScheme("only light")
 * @example css({ colorScheme: "only light" })
 */
export function colorScheme<Node extends Element = Element>(
	value: ColorSchemeValue = "light dark",
): UtilityMixin<Node> {
	return utility<Node>(() => ({ colorScheme: value }) as CSSStyles);
}
