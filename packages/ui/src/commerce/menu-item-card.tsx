/**
 * An item on a menu as one card: its name, a two-line description, its price and tags beside
 * its picture, with a round + over the picture. The whole card is a button that opens the
 * item's options dialog through Invoker Commands, so it opens without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { PlusIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Prop types for {@link MenuItemCard}. */
export namespace MenuItemCard {
	/** Props accepted by {@link MenuItemCard}. */
	export interface Props {
		/** The id of the dialog the card opens. */
		dialog: string;
		name: string;
		description?: string;
		/** The price as the reader sees it, such as "$11.50" or "From $11.50". */
		price: RemixNode;
		/** Words or badges after the price, such as "Popular" or a dietary tag. */
		badges?: RemixNode;
		/** The picture, such as the dish; the card shows no picture when unset. */
		media?: RemixNode;
		/** The colour behind the picture. */
		mediaBackground?: string;
		/** Hides the + when the item cannot be added now; the card still opens its details. */
		unavailable?: boolean;
	}
}

/**
 * Renders the card. It fills its grid cell, so a row of cards lines up whatever each
 * description's length.
 *
 * @example
 * <MenuItemCard dialog="item-tacos" name="Al pastor trio" description="Spit-roasted pork, pineapple" price="$11.50" media={<img src="/tacos.svg" alt="" />} />
 */
export function MenuItemCard(handle: Handle<MenuItemCard.Props>) {
	return () => {
		let {
			badges,
			description,
			dialog,
			media,
			mediaBackground,
			name,
			price,
			unavailable = false,
		} = handle.props;
		return (
			<button
				type="button"
				commandfor={dialog}
				command="show-modal"
				aria-haspopup="dialog"
				data-slot="menu-item-card"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: media === undefined ? "minmax(0, 1fr)" : "minmax(0, 1fr) 6.5rem",
						gap: "1rem",
						inlineSize: "100%",
						blockSize: "100%",
						padding: "1rem",
						boxSizing: "border-box",
						border: "0",
						borderRadius: "var(--ui-radius-lg, 1rem)",
						font: "inherit",
						textAlign: "start",
						color: "inherit",
						backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
						boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
						cursor: "pointer",
						transition: "box-shadow 160ms ease",
					}),
					when(
						"&:hover",
						raw({
							boxShadow:
								"inset 0 0 0 1px var(--ui-neutral-border-strong, var(--ui-neutral-fg-muted))",
						}),
					),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
					when(":target > &", raw({ boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" })),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				<span
					mix={[
						raw({ display: "grid", alignContent: "start", gap: "0.3125rem", minInlineSize: "0" }),
					]}
				>
					<span
						mix={[
							raw({ fontSize: "1rem", fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" }),
						]}
					>
						{name}
					</span>
					{description === undefined ? null : (
						<span
							mix={[
								raw({
									display: "-webkit-box",
									WebkitLineClamp: "2",
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
									fontSize: "0.875rem",
									lineHeight: "1.45",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{description}
						</span>
					)}
					<span
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: "0.5rem",
								marginBlockStart: "0.25rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									fontWeight: "650",
									fontVariantNumeric: "tabular-nums",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{price}
						</span>
						{badges}
					</span>
				</span>
				{media === undefined ? null : (
					<span
						data-slot="menu-item-card-media"
						mix={[
							raw({
								position: "relative",
								alignSelf: "start",
								inlineSize: "6.5rem",
								blockSize: "6.5rem",
								padding: "0.5rem",
								boxSizing: "border-box",
								borderRadius: "0.875rem",
								backgroundColor: mediaBackground ?? "var(--ui-neutral-bg-tint)",
							}),
						]}
					>
						{media}
						{unavailable ? null : (
							<span
								aria-hidden="true"
								data-slot="menu-item-card-add"
								mix={[
									raw({
										position: "absolute",
										insetInlineEnd: "-0.375rem",
										insetBlockEnd: "-0.375rem",
										display: "grid",
										placeItems: "center",
										inlineSize: "2.25rem",
										blockSize: "2.25rem",
										borderRadius: "999px",
										color: "var(--ui-neutral-fg-emphasis)",
										backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
										boxShadow:
											"0 0 0 1px var(--ui-neutral-border), 0 4px 10px -4px rgb(0 0 0 / 0.3)",
									}),
								]}
							>
								<PlusIcon size={18} />
							</span>
						)}
					</span>
				)}
			</button>
		);
	};
}
