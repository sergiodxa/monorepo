/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TextSizeName } from "../types";

import { compose } from "../internal/descriptor";

import { font } from "./font";
import { text } from "./text";

/**
 * Combines {@link text}'s `font-size`/`line-height` pair with the base sans
 * font family, always opinionating the style to `sans`. Pair `u.text()` with
 * an explicit `u.font()` when another family is needed.
 *
 * @example u.type("lg")
 * @example css({ fontFamily: "var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)", fontSize: "var(--ui-text-lg, 1.125rem)", lineHeight: "var(--ui-leading-lg, 1.5)" })
 */
export function type<Node extends Element = Element>(name: TextSizeName | (string & {})) {
	return compose<Node>([font<Node>("sans"), text<Node>(name)], (styles) => styles);
}
