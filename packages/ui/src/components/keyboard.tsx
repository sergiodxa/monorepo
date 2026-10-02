/**
 * A keyboard-shortcut hint rendered inside a native `<kbd>` element, drawn as the key
 * it names: a tinted, bordered cap sized to read beside the row's own text. Its
 * inline-start auto margin pushes it to the trailing edge of whatever row it sits in —
 * a menu item's command, a tooltip's accelerator, a button's shortcut label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { inlineFlex, items, justify } from "@sdxc/u/layout";
import { bs, minIs, mis, pi } from "@sdxc/u/size";
import { leading, text } from "@sdxc/u/typography";

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
 * Renders its children inside a `<kbd>` element drawn as a key cap, whose inline-start
 * auto margin pushes it to the trailing edge of whatever row it sits in — a menu item,
 * a tooltip, a button.
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
					/*
					 * A cap keeps its height and a minimum width whatever it holds, so a single
					 * letter and a two-glyph chord sit on the same line as each other.
					 */
					/*
					 * The cap centers its glyph without `center()`, because that pattern composes
					 * `flex()` and would turn the cap into a block of its own — a key standing on
					 * its own line in the middle of the sentence naming it.
					 */
					inlineFlex(),
					items("center"),
					justify("center"),
					bs("1.25rem"),
					minIs("1.25rem"),
					pi(1.5),
					rounded("sm"),
					bg("neutral.tint"),
					border({ color: "neutral", width: 1 }),
					fg("neutral"),
					text("xs"),
					leading("none"),
					mix,
				]}
			/>
		);
	};
}
