/**
 * The single-column stacking layout shared by every field convenience
 * wrapper's outermost host: its caption, control, and optional supporting
 * passage or validation message lay out in a narrow vertical stack, with
 * room between a label and its control for the control's focus ring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/component";

import { vstack } from "@sdxc/u/layout";

import type { CSSStyles } from "../utils/css-styles.js";

/**
 * Composes the single-column stack — a `0.5rem` gap between a field's own
 * caption, control, and optional supporting text — for a host's `mix` prop.
 * The gap clears the control's focus ring, drawn 2px off its edge and 3px wide.
 * Compose a separate `css()` call for the wider gap between whole fields.
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
	return vstack<Node>({ gap: "0.5rem" });
}
