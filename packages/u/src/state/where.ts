/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Sugar over `when("& :where({selector})", input)`, targeting descendants of
 * the host. `:where()` always contributes zero specificity, so the resulting
 * rule stays overridable by any later single-class rule.
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
