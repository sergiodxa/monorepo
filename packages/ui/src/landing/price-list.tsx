/**
 * A menu or price list for a landing: named groups of items, each a name joined to its price
 * by a dotted leader, with a line of description under it. Groups flow into as many columns
 * as the band's width holds, so the same list reads as a board on a desk and a column on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

import { Heading } from "../components/heading.js";

/** Narrowest a group's column gets before the list drops to fewer columns. */
const DEFAULT_COLUMN_WIDTH = "18rem";

/**
 * Prop types for {@link PriceList}.
 */
export namespace PriceList {
	/**
	 * Props accepted by {@link PriceList}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Narrowest a column gets, as a CSS length; the list fits as many columns as clear it.
		 * Defaults to {@link DEFAULT_COLUMN_WIDTH}.
		 */
		columnWidth?: string;
		/** One or more {@link PriceList.Group} elements. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link PriceList.Group}.
	 */
	export interface GroupProps extends Omit<TagProps<"div">, "title"> {
		/** The group's name, rendered as a heading at the ambient level. */
		title: RemixNode;
		/** A line under the title, such as when the group is served. */
		description?: RemixNode;
		/** One or more {@link PriceList.Item} elements. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link PriceList.Item}.
	 */
	export interface ItemProps extends Omit<TagProps<"li">, "children"> {
		/** What the item is called. */
		name: RemixNode;
		/** The price as the reader should see it, currency included. */
		price: RemixNode;
		/** A short line under the name: what is in it, or how it is sold. */
		children?: RemixNode;
	}
}

/**
 * Lays its groups into columns that each stay at least `columnWidth` wide, starting every
 * group at the top of its cell so a short group never stretches to its neighbour's height.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <PriceList>
 * 	<PriceList.Group title="Bread">
 * 		<PriceList.Item name="Country sourdough" price="$9">Two-day ferment, 900 g</PriceList.Item>
 * 	</PriceList.Group>
 * </PriceList>
 */
export function PriceList(handle: Handle<PriceList.Props>) {
	return () => {
		let { columnWidth, mix, ...rest } = handle.props;
		let width = columnWidth ?? DEFAULT_COLUMN_WIDTH;

		return (
			<div
				{...rest}
				data-slot="price-list"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${width}), 1fr))`,
							alignItems: "start",
							columnGap: "clamp(2rem, 5cqi, 4rem)",
							rowGap: "2.5rem",
						}),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * One named group: its heading, an optional line under it, then the items as a list.
 *
 * @param handle Runtime handle carrying the title, description and items.
 * @returns The render function producing the group's markup.
 */
PriceList.Group = function PriceListGroup(handle: Handle<PriceList.GroupProps>) {
	return () => {
		let { children, description, mix, title, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="price-list-group"
				mix={mergeMix([raw({ display: "flex", flexDirection: "column", gap: "1rem" })], mix)}
			>
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.25rem",
							paddingBlockEnd: "0.625rem",
							borderBlockEnd: "1px solid var(--ui-landing-hairline, var(--ui-neutral-border))",
						}),
					]}
				>
					<Heading
						data-slot="price-list-title"
						mix={[
							raw({
								margin: "0",
								fontFamily: "var(--ui-font-display)",
								fontSize: "1.375rem",
								lineHeight: "1.2",
								fontWeight: "var(--ui-landing-display-weight, 700)",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{title}
					</Heading>
					{description ? (
						<p
							mix={[
								raw({
									margin: "0",
									fontSize: "0.875rem",
									lineHeight: "1.4",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{description}
						</p>
					) : null}
				</div>
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "flex",
							flexDirection: "column",
							gap: "1rem",
						}),
					]}
				>
					{children}
				</ul>
			</div>
		);
	};
};

/**
 * One item: the name and the price on a shared baseline with a dotted leader filling the gap,
 * and the description under them. A long name wraps before it pushes the price off the row.
 *
 * @param handle Runtime handle carrying the name, price and description.
 * @returns The render function producing the item's markup.
 */
PriceList.Item = function PriceListItem(handle: Handle<PriceList.ItemProps>) {
	return () => {
		let { children, mix, name, price, ...rest } = handle.props;

		return (
			<li
				{...rest}
				data-slot="price-list-item"
				mix={mergeMix([raw({ display: "flex", flexDirection: "column", gap: "0.25rem" })], mix)}
			>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "baseline",
							gap: "0.5rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					<span data-slot="price-list-name" mix={[raw({ minInlineSize: "0" })]}>
						{name}
					</span>
					<span
						aria-hidden="true"
						data-slot="price-list-leader"
						mix={[
							raw({
								flex: "1 1 1.5rem",
								minInlineSize: "1.5rem",
								borderBlockEnd: "2px dotted var(--ui-neutral-border)",
								transform: "translateY(-0.25em)",
							}),
						]}
					/>
					<span
						data-slot="price-list-price"
						mix={[
							raw({
								flexShrink: "0",
								fontVariantNumeric: "tabular-nums",
								whiteSpace: "nowrap",
							}),
						]}
					>
						{price}
					</span>
				</span>
				{children ? (
					<span
						data-slot="price-list-description"
						mix={[
							raw({
								fontSize: "0.9375rem",
								lineHeight: "1.45",
								color: "var(--ui-neutral-fg)",
								textWrap: "pretty",
							}),
						]}
					>
						{children}
					</span>
				) : null}
			</li>
		);
	};
};
