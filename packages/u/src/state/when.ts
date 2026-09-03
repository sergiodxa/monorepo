/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * Leading characters the style serializer accepts as proof a style-tree key
 * is a nested selector; anything else is stringified as a declaration whose
 * value becomes `[object Object]`, which browsers discard.
 */
const NESTED_SELECTOR_PREFIXES = ["&", "@", ":", "[", "."];

/**
 * Selectors already reported outside development. `when()` is called on every
 * render of every element that uses it, so without this the same bad selector
 * would write a line to the log for each one.
 */
const WARNED_SELECTORS = new Set<string>();

/**
 * The primitive selector wrapper every other state wrapper (`hover()`,
 * `checked()`, ...) is sugar over. `selector` must start with `&`, `@`, `:`,
 * `[`, or `.`; see {@link checkNestedSelector} for what happens otherwise.
 *
 * @example u.when("&:has(input:checked)", [u.bg("brand.tint"), u.border("brand")])
 * @example css({ "&:has(input:checked)": { backgroundColor: "...", borderColor: "..." } })
 * @example u.when(":is(input:checked) ~ &", u.bg("brand.solid"))
 */
export function when<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	checkNestedSelector(selector);
	return compose(input, (styles) => nest(selector, styles));
}

/**
 * Reports a selector the serializer would misread as a declaration and silently
 * drop. No repair is correct in general, so callers wrap the reference element
 * themselves; throws in development, warns once in production.
 *
 * @param selector Selector a caller passed to {@link when}.
 * @throws In development only, when `selector` does not start with a character
 * the serializer recognizes as opening a nested selector.
 * @see {@link precededBy}
 */
function checkNestedSelector(selector: string): void {
	if (NESTED_SELECTOR_PREFIXES.some((prefix) => selector.startsWith(prefix))) return;

	let message = `@sdxc/u: when("${selector}") would be emitted as a declaration, not a rule, and dropped by the browser. Selectors must start with "&", "@", ":", "[" or "."; wrap a leading element or sibling in :is(), e.g. ":is(input:checked) ~ &".`;

	if (import.meta.env.DEV) throw new Error(message);

	if (WARNED_SELECTORS.has(selector)) return;
	WARNED_SELECTORS.add(selector);
	console.warn(message);
}
