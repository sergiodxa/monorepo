/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TextSizeName } from "../types";

import { compose } from "../internal/descriptor";

import { font } from "./font";
import { text } from "./text";

/**
 * A convenience combining {@link text}'s `font-size`/`line-height` pair with
 * the base sans font family, for the common case of setting a full text
 * style in one call instead of pairing `u.font("sans")` with `u.text()`
 * separately. Unlike bare `u.text()`, which is font-family agnostic so it
 * composes under any `u.font()` a call site already applied, `u.type()`
 * always opinionates the family to `sans` — reach for `u.text()` plus an
 * explicit `u.font()` when a non-sans family is needed alongside a text size.
 *
 * @example u.type("lg")
 * @example css({ fontFamily: "var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)", fontSize: "var(--ui-text-lg, 1.125rem)", lineHeight: "var(--ui-leading-lg, 1.5)" })
 */
export function type<Node extends Element = Element>(name: TextSizeName | (string & {})) {
	return compose<Node>([font<Node>("sans"), text<Node>(name)], (styles) => styles);
}
