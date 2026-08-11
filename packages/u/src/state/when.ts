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
 * The primitive selector wrapper. Flattens `input`, merges the flattened
 * utilities' style trees, and nests the merged tree under `selector` — the
 * primitive every other state wrapper (`hover()`, `checked()`, ...) is sugar
 * over.
 *
 * `selector` must start with `&`, `@`, `:`, `[` or `.`. A descendant- or
 * sibling-first selector such as `input:checked ~ &` is rejected: see
 * {@link assertNestedSelector} for why it cannot simply be repaired here.
 *
 * @example u.when("&:has(input:checked)", [u.bg("brand.tint"), u.border("brand")])
 * @example css({ "&:has(input:checked)": { backgroundColor: "...", borderColor: "..." } })
 * @example u.when(":is(input:checked) ~ &", u.bg("brand.solid"))
 */
export function when<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	assertNestedSelector(selector);
	return compose(input, (styles) => nest(selector, styles));
}

/**
 * Fails loudly on a selector the serializer would silently turn into an
 * `[object Object]` declaration, so the mistake surfaces on first render
 * instead of as UI that quietly has no checked, selected, or focus state.
 *
 * This throws rather than repairing the selector because there is no repair
 * that is correct in general. Wrapping the whole selector — `:is(input:checked
 * ~ &)` — is equivalent for most inputs, but `:is()` may not contain a
 * pseudo-element, so `input:checked ~ &::after` would become invalid CSS;
 * wrapping only the leading compound instead requires parsing the selector.
 * Callers know which part is the reference element, so they wrap it: hence
 * `precededBy()` and the `:is(...)` form in the message below.
 *
 * @param selector Selector a caller passed to {@link when}.
 * @throws When `selector` does not start with a character the serializer
 * recognizes as opening a nested selector.
 */
function assertNestedSelector(selector: string): void {
	if (NESTED_SELECTOR_PREFIXES.some((prefix) => selector.startsWith(prefix))) return;
	throw new Error(
		`@pkg/u: when("${selector}") would be emitted as a declaration, not a rule, and dropped by the browser. Selectors must start with "&", "@", ":", "[" or "."; wrap a leading element or sibling in :is(), e.g. ":is(input:checked) ~ &".`,
	);
}
