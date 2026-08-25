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
import { text } from "@pkg/u/typography";

/**
 * Prop types for {@link Keyboard}.
 */
export namespace Keyboard {
	/**
	 * Every native `<kbd>` attribute, unchanged, plus the `mix` passthrough.
	 * Renders as a small, muted, trailing-aligned annotation whose content is
	 * whatever `children` the consumer supplies — a key, a chord, a glyph.
	 */
	export interface Props extends TagProps<"kbd"> {}
}

/**
 * Renders its children inside a `<kbd>` element styled as a small, muted
 * shortcut hint whose inline-start auto margin pushes it to the trailing
 * edge of whatever row it sits in — a menu item, a tooltip, a button.
 *
 * @param handle Runtime handle carrying the host `<kbd>`'s props.
 * @returns The render function producing the shortcut hint's markup.
 * @example
 * <Keyboard>⌘K</Keyboard>
 */
export function Keyboard(handle: Handle<Keyboard.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <kbd {...rest} mix={[mis("auto"), fg("neutral.muted"), text("xs"), mix]} />;
	};
}
