/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";

import { utility } from "../internal/descriptor.js";

/**
 * The two standard CSS `appearance` values: `"none"` clears the platform's
 * native control chrome, `"auto"` restores it. Legacy compat keywords such as
 * `"textfield"` reach `appearance()` through its raw-string escape.
 */
export type AppearanceValue = "none" | "auto";

/**
 * Selects which vendor-prefixed properties `appearance()` mirrors its value
 * onto alongside the standard one. Pass `false` for a prefix whose engine has
 * its reset owned by a different rule.
 */
export interface AppearanceOptions {
	/** Also sets `WebkitAppearance` to the same value. Defaults to `true`. */
	webkit?: boolean;
	/** Also sets `MozAppearance` to the same value. Defaults to `true`. */
	moz?: boolean;
}

/**
 * Applies `appearance` to clear a form control's native platform chrome, which
 * Safari and Firefox honor only with their own prefixed property alongside the
 * standard one, so all three are emitted; `options` narrows that set.
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
