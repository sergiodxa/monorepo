/**
 * A caption for a form control, associated with its field either through
 * the native `for`/`id` relationship (set `htmlFor` to the field's `id`) or
 * by wrapping the control as a child. It renders as a single line of
 * emphasized text at the library's default label size, weight, and color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { fontSize, leading, weight } from "@sdxc/u/typography";

/**
 * Prop types for {@link Label}.
 */
export namespace Label {
	/**
	 * Every native `<label>` attribute, unchanged, plus the `mix` passthrough.
	 * Renders at the library's default caption size, medium weight, and
	 * emphasized neutral foreground; set `htmlFor` or nest the field as a child.
	 */
	export interface Props extends TagProps<"label"> {}
}

/**
 * Renders its children inside a native `<label>` element, sized and colored
 * as a form field caption. Pair it with a field by setting `htmlFor` to the
 * field's `id`, or wrap the field directly so the platform associates them.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the label's markup.
 * @example
 * <Label htmlFor="email">{t("form.email.label")}</Label>
 * @example
 * <Label>
 * 	{t("form.newsletter.label")}
 * 	<input type="checkbox" name="newsletter" />
 * </Label>
 */
export function Label(handle: Handle<Label.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<label
				{...rest}
				mix={[weight("medium"), fg("neutral.emphasis"), fontSize("sm"), leading("none"), mix]}
			/>
		);
	};
}
