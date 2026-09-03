/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { compose } from "../internal/descriptor.js";
import { when } from "../state/when.js";

import { media } from "./media.js";

/**
 * Applies the given utilities under both the forced `.dark`/`.light` class
 * and the system-preference `.system` class behind `prefers-color-scheme`,
 * so both stay in sync. Composed from `u.when()` and `u.media()`.
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
