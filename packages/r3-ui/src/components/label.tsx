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

import { css } from "remix/ui";

/**
 * Prop types for {@link Label}.
 */
export namespace Label {
	/**
	 * Every native `<label>` attribute, unchanged, plus the `mix` passthrough.
	 * A label carries no color, variant, or size prop of its own — it always
	 * renders at the library's default caption size, medium weight, and
	 * emphasized neutral foreground color. Set `htmlFor` to associate the
	 * label with a field by `id`, or nest the field as a child instead.
	 */
	export interface Props extends TagProps<"label"> {}
}

/**
 * Renders its children inside a native `<label>` element, sized and colored
 * as a form field caption: the library's default caption size at medium
 * weight, its line height collapsed to one, in the emphasized neutral
 * foreground color. Pair it with a field by setting `htmlFor` to the
 * field's `id`, or wrap the field directly so the platform associates them
 * without an `id` at all.
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
				mix={[
					css({
						fontSize: "0.875rem",
						lineHeight: "1",
						fontWeight: 500,
						color: "var(--ui-neutral-fg-emphasis)",
					}),
					mix,
				]}
			/>
		);
	};
}
