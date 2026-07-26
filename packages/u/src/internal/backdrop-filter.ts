/**
 * `backdrop-filter` is a single CSS property, so two independent utilities
 * that each set it outright (`backdropFilter: blur(...)`, `backdropFilter:
 * saturate(...)`) would silently overwrite each other when composed on the
 * same element instead of combining — the exact same problem
 * `internal/transform.ts` solves for `transform`. Every backdrop-filter
 * utility instead sets its own CSS custom property (`--ui-backdrop-blur`,
 * `--ui-backdrop-saturate`, ...) and the exact same fixed `backdropFilter`
 * declaration, one composite expression referencing every backdrop-filter
 * function's variable with an identity fallback (`0px`, `1`, ...). Custom
 * properties from separate classes on the same element all apply
 * simultaneously — only the *value* text of `backdropFilter` matters for the
 * cascade, and since that text is identical across every backdrop-filter
 * utility, it doesn't matter which one's copy of it "wins"; the resolved
 * `backdropFilter` always reads every variable any applied utility set, and
 * defaults for every variable no utility touched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { var as varUtility } from "../general/var";

import type { CSSStyles } from "./css-styles";
import type { UtilityMixin } from "./descriptor";

import { utility } from "./descriptor";

/** The CSS custom property (without its leading `--`) each backdrop-filter function reads from. */
const BACKDROP_FILTER_VARS = {
	blur: "ui-backdrop-blur",
	saturate: "ui-backdrop-saturate",
} as const;

export type BackdropFilterFunctionName = keyof typeof BACKDROP_FILTER_VARS;

/** The fixed, identical-everywhere `backdropFilter` value every backdrop-filter utility emits. */
export const COMPOSITE_BACKDROP_FILTER = [
	`blur(${varUtility(BACKDROP_FILTER_VARS.blur, "0px")})`,
	`saturate(${varUtility(BACKDROP_FILTER_VARS.saturate, "1")})`,
].join(" ");

/**
 * Builds a composable backdrop-filter-function utility: sets the specific
 * `--ui-backdrop-{name}` custom property (or properties) given, plus the
 * shared composite `backdropFilter` declaration (and its `WebkitBackdropFilter`
 * mirror, for Safari, which doesn't yet resolve the unprefixed property),
 * so calling more than one backdrop-filter utility on the same element
 * combines every function instead of the last one overwriting the rest.
 */
export function backdropFilterFunction<Node extends Element = Element>(
	values: Partial<Record<BackdropFilterFunctionName, string>>,
): UtilityMixin<Node> {
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		for (let name of Object.keys(values) as BackdropFilterFunctionName[]) {
			result[`--${BACKDROP_FILTER_VARS[name]}`] = values[name] as string;
		}
		result.backdropFilter = COMPOSITE_BACKDROP_FILTER;
		result.WebkitBackdropFilter = COMPOSITE_BACKDROP_FILTER;
		return result as CSSStyles;
	});
}
