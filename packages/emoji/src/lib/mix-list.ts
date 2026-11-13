/**
 * Flattens a host's existing `mix` prop into an array so mixins can append
 * without nesting ternaries at each call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps } from "remix/component";

type MixValue = NonNullable<ElementProps["mix"]>;
type MixItem = MixValue extends readonly (infer Item)[] ? Item : MixValue;

/**
 * @param mix - Whatever the host already carried on `props.mix`
 * @returns Zero, one, or many mix descriptors ready to spread
 */
export function mixList(mix: ElementProps["mix"]): MixItem[] {
	if (mix === undefined) return [];
	if (Array.isArray(mix)) return [...mix];
	return [mix as MixItem];
}
