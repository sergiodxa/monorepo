/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The two standard CSS `appearance` values: `"none"` clears the platform's
 * native control chrome, `"auto"` restores it. Any other string still
 * type-checks — `appearance` also accepts a handful of legacy "compat"
 * keywords (`"menulist-button"`, `"textfield"`, `"searchfield"`, ...) that
 * make one control type mimic another's native rendering, which are niche
 * enough not to enumerate here.
 */
export type AppearanceValue = "none" | "auto";

/**
 * A primitive form-control reset utility mapping to the CSS `appearance`
 * property, mirrored onto the `-webkit-appearance` and `-moz-appearance`
 * vendor-prefixed properties as well — Safari and Firefox both still
 * require their own prefixed property alongside the standard one to fully
 * clear a `<meter>`, `<progress>`, or range `<input>`'s native rendering in
 * every supported engine. It only clears the platform's native control
 * chrome; it does not apply any replacement visual recipe, which stays
 * owned by component packages or apps.
 *
 * @example u.appearance()
 * @example css({ appearance: "none", WebkitAppearance: "none", MozAppearance: "none" })
 * @example u.appearance("auto")
 * @example css({ appearance: "auto", WebkitAppearance: "auto", MozAppearance: "auto" })
 */
export function appearance<Node extends Element = Element>(
	value: AppearanceValue | (string & {}) = "none",
) {
	return utility<Node>(() => ({
		WebkitAppearance: value,
		MozAppearance: value,
		appearance: value,
	}));
}
