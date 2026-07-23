/**
 * A keyboard-shortcut hint rendered inside a native `<kbd>` element, sized
 * and colored as a small muted annotation. Its inline-start auto margin
 * pushes it to the trailing edge of whatever row it sits in — a menu item's
 * command, a tooltip's accelerator, a button's shortcut label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { mis } from "@pkg/u/size";
import { css } from "remix/ui";

/**
 * Prop types for {@link Keyboard}.
 */
export namespace Keyboard {
	/**
	 * Every native `<kbd>` attribute, unchanged, plus the `mix` passthrough.
	 * A shortcut hint carries no color, variant, or size contract of its own
	 * — it always renders as a small, muted, trailing-aligned annotation,
	 * and its content is whatever `children` the consumer supplies (a single
	 * key, a chorded sequence such as `"⌘K"`, or a platform-specific glyph).
	 */
	export interface Props extends TagProps<"kbd"> {}
}

/**
 * Renders its children inside a `<kbd>` element styled as a small, muted
 * shortcut hint whose inline-start auto margin pushes it to the trailing
 * edge of whatever row it sits in — a menu item's command, a tooltip's
 * accelerator, a button's shortcut label.
 *
 * @param handle Runtime handle carrying the host `<kbd>`'s props.
 * @returns The render function producing the shortcut hint's markup.
 * @example
 * <Keyboard>⌘K</Keyboard>
 */
export function Keyboard(handle: Handle<Keyboard.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<kbd
				{...rest}
				mix={[
					mis("auto"),
					fg("neutral.muted"),
					css({
						fontSize: "0.75rem",
						lineHeight: "1rem",
					}),
					mix,
				]}
			/>
		);
	};
}
