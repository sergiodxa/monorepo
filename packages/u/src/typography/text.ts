/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TextSizeName } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { text as textToken } from "../internal/tokens";

/**
 * Applies `font-size` from the named text scale (`xs` through `9xl`, or an
 * app-extended name) together with its paired `line-height`. Font size
 * resolves through `var(--ui-text-{name}, fallback)`; line height resolves
 * through the companion `var(--ui-leading-{name}, 1.5)` variable, so an app
 * extending the scale with, say, `hero` gets a matched line height the
 * moment it defines `--ui-leading-hero` alongside `--ui-text-hero`. This
 * utility does not set `font-family`; pair it with `u.font()` or reach for
 * `u.type()` when a call site also wants the base sans family in one call.
 *
 * @example u.text("lg")
 * @example css({ fontSize: "var(--ui-text-lg, 1.125rem)", lineHeight: "var(--ui-leading-lg, 1.5)" })
 */
export function text<Node extends Element = Element>(name: TextSizeName | (string & {})) {
	return utility<Node>(() => ({
		fontSize: textToken(name),
		lineHeight: varUtility(`ui-leading-${name}`, "1.5"),
	}));
}
