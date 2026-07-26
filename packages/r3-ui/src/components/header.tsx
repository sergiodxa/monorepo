/**
 * A small, muted section label rendered inside a native `<header>` element —
 * the heading that introduces a group of related items inside a listbox,
 * menu, or combobox section. It carries no interactive behavior of its own,
 * only the compact uppercase typography that sets it apart from the items
 * beneath it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { raw } from "@pkg/u/general";
import { pb, pi } from "@pkg/u/size";
import { text, tracking, weight } from "@pkg/u/typography";

/**
 * Props accepted by {@link Header}.
 */
export namespace Header {
	/**
	 * Every native `<header>` attribute, unchanged, plus the `mix`
	 * passthrough. A section label carries no color, variant, or size
	 * contract of its own — its content is whatever `children` the consumer
	 * supplies (a section's name, most often plain text).
	 */
	export interface Props extends TagProps<"header"> {}
}

/**
 * Renders its children inside a `<header>` element styled as a small,
 * muted, uppercase section label — the heading introducing a group of
 * related items inside a listbox, menu, or combobox section.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the section label's markup.
 * @example
 * <Header>Fruits</Header>
 */
export function Header(handle: Handle<Header.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<header
				{...rest}
				mix={[
					pi(3),
					pb(1.5),
					weight("semibold"),
					tracking("wider"),
					fg("neutral.muted"),
					text("xs"),
					raw({ textTransform: "uppercase" }),
					mix,
				]}
			/>
		);
	};
}
