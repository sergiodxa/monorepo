/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlurName } from "../types";

import { filterFunction } from "../internal/filter";
import { blur as blurToken } from "../internal/tokens";

/**
 * Applies a `filter: blur(...)` from the blur scale. Composes through the
 * shared composite `filter` declaration — it writes only its own
 * `--ui-filter-blur` custom property, so applying it alongside
 * `u.grayscale()`, `u.brightness()`, or any other filter utility combines
 * every function instead of the last one overwriting the rest.
 *
 * @example u.blur("lg")
 * @example css({ "--ui-filter-blur": "var(--ui-blur-lg, 24px)", filter: "blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1)) ..." })
 */
export function blur<Node extends Element = Element>(name: BlurName | (string & {}) = "md") {
	return filterFunction<Node>({ blur: blurToken(name) });
}
