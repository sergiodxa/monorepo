/**
 * A run of small body copy, styled at the library's default text size and
 * the neutral muted foreground color. It carries no color, variant, or size
 * contract of its own — a description beneath a heading, a caption beside a
 * control, or any other passage of supporting copy renders through it at a
 * single, consistent intensity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { text } from "@pkg/u/typography";

/**
 * Prop types for {@link Text}.
 */
export namespace Text {
	/**
	 * Every native `<span>` attribute, unchanged, plus the `mix` passthrough.
	 * Carries no color, variant, or size prop of its own — always rendering
	 * at the library's default body-copy size and muted foreground color.
	 */
	export interface Props extends TagProps<"span"> {}
}

/**
 * Renders its children inside a `<span>` sized and colored as a small run of
 * body copy: the library's default text size paired with the neutral muted
 * foreground color.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the text run's markup.
 * @example
 * <Text>{t("client.description")}</Text>
 */
export function Text(handle: Handle<Text.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <span {...rest} mix={[fg("neutral"), text("sm"), mix]} />;
	};
}
