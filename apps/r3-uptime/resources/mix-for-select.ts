/**
 * Re-types a `css()` mixin for `<select>`. `<select>`'s `mix` prop is typed against
 * `HTMLSelectElement`, but `css()` always returns a `MixinDescriptor<Element, ...>` —
 * TypeScript can't narrow `boundNode` from a `css()` call since none of its arguments
 * reference the node type, and `MixinDescriptor`'s `type` field threads that node
 * through `MixinHandle` in both covariant and contravariant positions, so `Element`
 * and `HTMLSelectElement` versions aren't assignable to each other. Only the
 * compile-time type changes here; the runtime value is identical.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from "remix/ui";

export function mixForSelect(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<HTMLSelectElement, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<
		HTMLSelectElement,
		CSSMixinDescriptor["args"],
		ElementProps
	>;
}
