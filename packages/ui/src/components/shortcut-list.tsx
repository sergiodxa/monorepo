/**
 * The list a keyboard-shortcuts panel shows: a native `<dl>` pairing each action with the
 * key caps that run it, laid out in two columns so every key lands on one vertical line
 * and the list reads down that line instead of across ragged hints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { contents, flex, gap, grid, gridTemplate, items, justify } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

import { Keyboard } from "./keyboard.js";

/**
 * Prop types for {@link ShortcutList} and its compound parts.
 */
export namespace ShortcutList {
	/**
	 * Props accepted by {@link ShortcutList}.
	 */
	export interface Props extends TagProps<"dl"> {
		/** One {@link ShortcutList.Item} per binding, in the order the panel lists them. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link ShortcutList.Item}.
	 */
	export interface ItemProps extends TagProps<"div"> {
		/**
		 * The caps to press, in press order, each already the glyph to print — a combo
		 * formatted for the reader's keyboard by `keyComboGlyphs()`, or a bare character.
		 */
		keys: string[];
		/** What pressing the keys does. */
		children: RemixNode;
	}
}

/**
 * Renders the list's host `<dl>`, a two-column grid whose first column takes the actions
 * and whose second sizes itself to the widest run of caps.
 *
 * @param handle Runtime handle carrying the host `<dl>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <ShortcutList>
 * 	<ShortcutList.Item keys={keyComboGlyphs("mod+k", apple)}>{t("openSearch")}</ShortcutList.Item>
 * 	<ShortcutList.Item keys={["?"]}>{t("showShortcuts")}</ShortcutList.Item>
 * </ShortcutList>
 */
export function ShortcutList(handle: Handle<ShortcutList.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<dl
				{...rest}
				data-slot="shortcut-list"
				mix={[m(0), grid(), gap(2, 4), items("center"), gridTemplate({ columns: "1fr auto" }), mix]}
			>
				{children}
			</dl>
		);
	};
}

/**
 * Renders one binding as a `<dt>` naming the action and a `<dd>` holding a cap per key.
 * The wrapping `<div>` lays out as its children, so both cells join the list's own grid.
 *
 * @param handle Runtime handle carrying the wrapping `<div>`'s props.
 * @returns The render function producing the binding's markup.
 * @example
 * <ShortcutList.Item keys={["⌘", "K"]}>{t("openSearch")}</ShortcutList.Item>
 */
ShortcutList.Item = function ShortcutListItem(handle: Handle<ShortcutList.ItemProps>) {
	return () => {
		let { children, keys, mix, ...rest } = handle.props;

		return (
			<div {...rest} data-slot="shortcut" mix={[contents(), mix]}>
				<dt mix={[text("sm"), fg("neutral")]}>{children}</dt>
				<dd mix={[m(0), flex(), gap(1), items("center"), justify("end")]}>
					{keys.map((key, index) => (
						<Keyboard key={`${index}-${key}`} mix={[m(0), weight("medium")]}>
							{key}
						</Keyboard>
					))}
				</dd>
			</div>
		);
	};
};
