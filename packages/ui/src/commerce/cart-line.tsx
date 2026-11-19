/**
 * One line of a cart or an order: a small picture, the item's name, the picks that made it
 * and its price, with room at the end for a control such as a quantity stepper. Lines sit in
 * a list separated by hairlines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

/** Prop types for {@link CartLine}. */
export namespace CartLine {
	/** Props accepted by {@link CartLine}; the host is an `<li>`. */
	export interface Props extends Omit<TagProps<"li">, "children"> {
		name: RemixNode;
		/** The picks, such as "Blue corn · Guacamole". */
		details?: RemixNode;
		/** The line's price as the reader sees it. */
		price: RemixNode;
		media?: RemixNode;
		/** The colour behind the picture. */
		mediaBackground?: string;
		/** A control at the end, such as a {@link QuantityStepper}. */
		action?: RemixNode;
	}
}

/**
 * Renders the line inside a list the caller draws.
 *
 * @example
 * <ul><CartLine name="Al pastor trio" details="Blue corn · Verde" price="$11.50" action={<QuantityStepper … />} /></ul>
 */
export function CartLine(handle: Handle<CartLine.Props>) {
	return () => {
		let { action, details, media, mediaBackground, mix, name, price, ...rest } = handle.props;
		return (
			<li
				{...rest}
				data-slot="cart-line"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridTemplateColumns: `${media === undefined ? "" : "3rem "}minmax(0, 1fr) auto`,
							alignItems: "center",
							gap: "0.75rem",
							paddingBlock: "0.75rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border-subtle, var(--ui-neutral-border))",
						}),
					],
					mix,
				)}
			>
				{media === undefined ? null : (
					<span
						data-slot="cart-line-media"
						mix={[
							raw({
								display: "grid",
								placeItems: "center",
								inlineSize: "3rem",
								blockSize: "3rem",
								padding: "0.25rem",
								boxSizing: "border-box",
								borderRadius: "0.75rem",
								overflow: "clip",
								backgroundColor: mediaBackground ?? "var(--ui-neutral-bg-subtle)",
							}),
						]}
					>
						{media}
					</span>
				)}
				<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
					<span mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}>
						{name}
					</span>
					{details === undefined ? null : (
						<span
							mix={[
								raw({
									fontSize: "0.8125rem",
									lineHeight: "1.35",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{details}
						</span>
					)}
					<span
						mix={[
							raw({ fontSize: "0.875rem", fontWeight: "600", fontVariantNumeric: "tabular-nums" }),
						]}
					>
						{price}
					</span>
				</span>
				{action === undefined ? <span /> : action}
			</li>
		);
	};
}
