/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose } from "../internal/descriptor";
import { when } from "../state/when";

import { media } from "./media";

/**
 * The color-scheme wrapper for light and dark mode rules — not a direct
 * `color-scheme` property utility. Applies the given utilities under both
 * halves of the theme's dark-mode contract: a forced `.dark`/`.light`
 * ancestor class, and system preference through a `.system` ancestor class
 * gated behind the matching `prefers-color-scheme` media query. Both halves
 * stay in sync so forced and system modes render identically. Composes
 * `u.when()` for the class selectors and `u.media()` for the system-
 * preference gate — no hand-built selector or at-rule of its own.
 *
 * @example u.scheme("dark", u.bg("neutral.solid"))
 * @example css({ ".dark &": { backgroundColor: "..." }, "@media (prefers-color-scheme: dark)": { ".system &": { backgroundColor: "..." } } })
 */
export function scheme<Node extends Element = Element>(
	mode: "dark" | "light",
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose<Node>(
		[
			when<Node>(`.${mode} &`, input),
			media<Node>(`(prefers-color-scheme: ${mode})`, when<Node>(".system &", input)),
		],
		(styles) => styles,
	);
}
