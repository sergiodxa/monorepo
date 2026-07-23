/**
 * A short passage of supporting copy beneath a form control, styled at the
 * library's default text size and the neutral muted foreground color. It
 * renders as a native `<p>` so a consumer can wire its `id` into the
 * control's `aria-describedby`, giving assistive technology a spoken hint,
 * format requirement, or constraint alongside the control's label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { css } from "remix/ui";

/**
 * Prop types for {@link Description}.
 */
export namespace Description {
	/**
	 * Every native `<p>` attribute, unchanged, plus the `mix` passthrough.
	 * A description carries no color, variant, or size prop of its own — it
	 * always renders at the library's default body-copy size and muted
	 * foreground color, and its content is whatever `children` the consumer
	 * supplies. Give it an `id` and reference that `id` from the paired
	 * control's `aria-describedby` to associate the two.
	 */
	export interface Props extends TagProps<"p"> {}
}

/**
 * Renders its children inside a `<p>` sized and colored as a small run of
 * supporting copy: the library's default text size paired with the neutral
 * muted foreground color. Place it after a control inside a field wrapper —
 * a format hint under a password field, a constraint note under a username
 * field, or any other passage of explanatory text describing what the
 * control expects.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Description id="password-hint">
 *   {t("field.password.hint")}
 * </Description>
 */
export function Description(handle: Handle<Description.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				mix={[
					fg("neutral.muted"),
					css({
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
					}),
					mix,
				]}
			/>
		);
	};
}
