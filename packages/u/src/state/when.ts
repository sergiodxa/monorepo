/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * Leading characters the style serializer accepts as proof that a style-tree
 * key is a nested selector rather than a CSS property. Anything else is
 * treated as a declaration name, so its object of styles is stringified into
 * `[object Object]` and the browser drops the whole rule.
 */
const NESTED_SELECTOR_PREFIXES = ["&", "@", ":", "[", "."];

/**
 * Selectors already reported outside development. `when()` is called on every
 * render of every element that uses it, so without this the same bad selector
 * would write a line to the log for each one.
 */
const WARNED_SELECTORS = new Set<string>();

/**
 * The primitive selector wrapper. Flattens `input`, merges the flattened
 * utilities' style trees, and nests the merged tree under `selector` — the
 * primitive every other state wrapper (`hover()`, `checked()`, ...) is sugar
 * over.
 *
 * `selector` must start with `&`, `@`, `:`, `[` or `.`. A descendant- or
 * sibling-first selector such as `input:checked ~ &` is rejected — by throwing
 * in development, by warning once and rendering without the rule in
 * production: see {@link checkNestedSelector} for why it cannot simply be
 * repaired here, and why the severity differs.
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
 * Reports a selector the serializer would silently turn into an `[object
 * Object]` declaration, so the mistake surfaces instead of as UI that quietly
 * has no checked, selected, or focus state.
 *
 * Neither branch repairs the selector, because there is no repair that is
 * correct in general. Wrapping the whole selector — `:is(input:checked ~ &)` —
 * is equivalent for most inputs, but `:is()` may not contain a pseudo-element,
 * so `input:checked ~ &::after` would become invalid CSS; wrapping only the
 * leading compound instead requires parsing the selector. Callers know which
 * part is the reference element, so they wrap it: hence `precededBy()` and the
 * `:is(...)` form in the message below.
 *
 * The severity is conditional because the cost of the mistake is not the same
 * on both sides. In development someone is watching, and a throw is the
 * fastest way to be told; in production the mistake costs one missing style,
 * while a throw costs the whole render — and a render that throws inside a
 * `Frame` fragment never streams its content, leaving the page on its loading
 * skeleton forever with nothing written down about why.
 *
 * @param selector Selector a caller passed to {@link when}.
 * @throws In development only, when `selector` does not start with a character
 * the serializer recognizes as opening a nested selector.
 */
function checkNestedSelector(selector: string): void {
	if (NESTED_SELECTOR_PREFIXES.some((prefix) => selector.startsWith(prefix))) return;

	let message = `@pkg/u: when("${selector}") would be emitted as a declaration, not a rule, and dropped by the browser. Selectors must start with "&", "@", ":", "[" or "."; wrap a leading element or sibling in :is(), e.g. ":is(input:checked) ~ &".`;

	if (import.meta.env.DEV) throw new Error(message);

	if (WARNED_SELECTORS.has(selector)) return;
	WARNED_SELECTORS.add(selector);
	console.warn(message);
}
