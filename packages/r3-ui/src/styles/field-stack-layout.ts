/**
 * The single-column stacking layout shared by every field convenience
 * wrapper's outermost host: its caption, control, and optional supporting
 * passage or validation message lay out in a narrow vertical stack with a
 * small gap between them, keeping a label sitting close to the control it
 * describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { vstack } from "@pkg/u/layout";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Composes the single-column stacking layout shared by every field
 * convenience wrapper's outermost host: its caption, control, and optional
 * supporting passage or validation message lay out in a narrow vertical
 * stack with a `0.25rem` gap between them, keeping a label sitting close to
 * the control it describes. A wider vertical rhythm — stacking whole fields
 * one after another, rather than a field's own internal parts — calls for
 * its own, larger gap through a separate `css()` call composed alongside
 * this one.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div data-slot="date-field" mix={[fieldStackLayout(), mix]}>
 * 	<Label htmlFor={handle.id}>{label}</Label>
 * 	<Input id={handle.id} />
 * </div>;
 */
export function fieldStackLayout<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return vstack<Node>({ gap: "0.25rem" });
}
