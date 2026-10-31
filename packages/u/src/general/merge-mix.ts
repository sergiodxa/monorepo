/**
 * Merges a component's own `mix` with the one its caller passes, so a caller's
 * utility overrides the component's utility for the same property. Separate
 * classes on one element resolve by the page's first use of each class, so the
 * merge emits one class whose cascade sublayers put the caller's styles last.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MixInput } from "remix/component";

import type { UtilityMixin } from "../internal/descriptor.js";

import { compose, isUtility, nest } from "../internal/descriptor.js";

import { combine } from "./combine.js";

/**
 * The leaves of a `mix` value, split into utilities, whose style trees merge,
 * and every other mixin, which applies unchanged.
 */
interface MixParts<Node extends Element> {
	utilities: UtilityMixin<Node>[];
	others: MixInput<Node>[];
}

/**
 * Flattens `input` the way a `mix` prop does, dropping falsy values and
 * keeping each leaf's position within its group.
 */
function split<Node extends Element>(
	input: MixInput<Node>,
	parts: MixParts<Node> = { utilities: [], others: [] },
): MixParts<Node> {
	if (!input) return parts;
	if (Array.isArray(input)) {
		for (let item of input as ReadonlyArray<MixInput<Node>>) split(item, parts);
		return parts;
	}
	if (isUtility<Node>(input)) parts.utilities.push(input);
	else parts.others.push(input);
	return parts;
}

/**
 * Applies `mix` on top of `base`: the utilities of both render as one class,
 * `mix`'s in a later cascade sublayer, so they win whatever selector `base`
 * nests its rule under. Other mixins apply unchanged; with no utility in
 * `mix`, `base` renders exactly as it would alone.
 *
 * @param base The component's own mixins.
 * @param mix The caller's mixins, which win on any property both set.
 * @returns A value for the host element's `mix` prop.
 * @example <span mix={mergeMix([fg("neutral"), text("sm")], mix)} />
 */
export function mergeMix<Node extends Element = Element>(
	base: MixInput<Node>,
	mix: MixInput<Node>,
): MixInput<Node> {
	let overrides = split(mix);
	if (overrides.utilities.length === 0) return [base, mix];
	let defaults = split(base);
	return [
		...defaults.others,
		...overrides.others,
		combine<Node>([
			compose<Node>(defaults.utilities, (styles) => nest("@layer defaults", styles)),
			compose<Node>(overrides.utilities, (styles) => nest("@layer overrides", styles)),
		]),
	];
}
