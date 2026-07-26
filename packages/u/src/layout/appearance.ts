/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";

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
 * Controls which vendor-prefixed properties `appearance()` mirrors its value
 * onto alongside the standard `appearance` property. Both default to `true`,
 * preserving the historical all-three-properties behavior; pass `false` for
 * a prefix when the surrounding hand-written CSS deliberately leaves that
 * engine's reset to a different rule (or leaves it untouched because
 * resetting it there would be a real behavior change on that engine).
 */
export interface AppearanceOptions {
	/** Also sets `WebkitAppearance` to the same value. Defaults to `true`. */
	webkit?: boolean;
	/** Also sets `MozAppearance` to the same value. Defaults to `true`. */
	moz?: boolean;
}

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
 * The second `options` argument narrows which vendor prefixes get mirrored,
 * for the rarer case where a specific vendor pseudo-element or
 * browser-specific rule only ever had one prefix hand-written against it —
 * because a different rule elsewhere already resets the other engine, or
 * because mirroring it there would be a genuine behavior change on that
 * engine. Omitting it (or passing `{}`) keeps the historical all-three
 * behavior.
 *
 * @example u.appearance()
 * @example css({ appearance: "none", WebkitAppearance: "none", MozAppearance: "none" })
 * @example u.appearance("auto")
 * @example css({ appearance: "auto", WebkitAppearance: "auto", MozAppearance: "auto" })
 * @example u.appearance("none", { moz: false }) // Chromium/Safari-only vendor reset
 * @example css({ appearance: "none", WebkitAppearance: "none" })
 */
export function appearance<Node extends Element = Element>(
	value: AppearanceValue | (string & {}) = "none",
	options: AppearanceOptions = {},
) {
	let { webkit = true, moz = true } = options;
	return utility<Node>(() => {
		let result: Record<string, string> = { appearance: value };
		if (webkit) result.WebkitAppearance = value;
		if (moz) result.MozAppearance = value;
		return result as CSSStyles;
	});
}
