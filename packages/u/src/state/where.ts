/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("& :where({selector})", input)`. Note the space before
 * `:where(` — this targets *descendants* matching `selector`, not the host.
 *
 * The point is specificity, not matching. `:where()` always contributes zero
 * specificity, whatever is inside it, so a rule written through this wrapper
 * can be overridden by any later single-class rule — including a plain
 * utility applied directly to the descendant. That makes it the tool for
 * typographic defaults over markup you do not control: a prose or article
 * component styling rendered Markdown, where `& :where(a)`, `& :where(pre)`,
 * and `& :where(th, td)` set sensible defaults a consumer can then override
 * on any individual element without a specificity fight. That one pattern is
 * where it earns its place, and it is exactly how a "prose" component is
 * normally built.
 *
 * Contrast the neighbours: `has()` uses `:has()`, which *takes* the
 * specificity of its most specific argument, so the two are near-opposites in
 * that respect despite looking similar. And `:where()` accepts a forgiving
 * selector list — one unsupported or invalid selector in the list does not
 * invalidate the whole rule the way it would in a normal comma-separated
 * list, which is genuinely useful when targeting newer pseudo-elements.
 *
 * For the host rather than its descendants, `when("&:where(...)", input)`
 * without the space is the form. This wrapper deliberately picks the
 * descendant case because that is the one with a real use.
 *
 * @example u.where("a", u.fg("brand"))
 * @example css({ "& :where(a)": { color: "..." } })
 * @example u.where("th, td", u.p(2))
 * @example css({ "& :where(th, td)": { padding: "..." } })
 */
export function where<Node extends Element = Element>(
	selector: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>(`& :where(${selector})`, input);
}
