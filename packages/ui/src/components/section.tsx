/**
 * A grouping wrapper for a set of related items inside a listbox, menu, or
 * combobox — a native `<section>` element carrying the small block-axis
 * padding that sets one group apart from the next. Pairing it with a
 * `Header` as its first child gives the group a visible label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { pb } from "@sdxc/u/size";

/**
 * Props accepted by {@link Section}.
 */
export namespace Section {
	/**
	 * Every native `<section>` attribute, unchanged, plus the `mix`
	 * passthrough. Content is whatever `children` the consumer supplies,
	 * most often a `Header` label followed by the group's items.
	 */
	export interface Props extends TagProps<"section"> {}
}

/**
 * Renders its children inside a `<section>` element with small block-axis
 * padding, separating one group of items from its siblings inside a
 * listbox, menu, or combobox; pair it with a `Header` to label the group.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Section aria-labelledby="account-heading">
 * 	<Header id="account-heading">{t("settings.account")}</Header>
 * 	<ListBox.Item id="profile">{t("settings.profile")}</ListBox.Item>
 * 	<ListBox.Item id="billing">{t("settings.billing")}</ListBox.Item>
 * </Section>
 */
export function Section(handle: Handle<Section.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <section {...rest} mix={[pb("0.25rem"), mix]} />;
	};
}
