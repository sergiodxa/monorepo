/**
 * A restaurant's page: its hero and delivery terms, a sticky bar of menu categories that
 * follows the scroll, and the menu. Each dish opens a native dialog asking for its required
 * and optional picks, each with its price, and posts the dish into the cart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	ChevronLeftIcon,
	InfoIcon,
	MapPinIcon,
	PlusIcon,
	TriangleAlertIcon,
	XIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { SECTION_BAR_BLOCK_SIZE, SectionBar } from "@sdxc/ui/section-bar";

import type { MenuItem, OptionGroup, Restaurant } from "./data";
import type { Visitor } from "./state";

import { Backdrop, DishArt } from "./art";
import { actionHref, findCuisine, href, itemGroups, money } from "./data";
import { ItemLive } from "./item-live";
import {
	CARD_RADIUS,
	CartPanel,
	DishTag,
	GUTTER,
	Gutter,
	RestaurantFacts,
	TOP_BAR,
	WIDE,
} from "./parts";
import { lineCount } from "./state";

/** The id of a dish's dialog. */
function dialogId(entry: MenuItem): string {
	return `bocado-item-${entry.id}`;
}

/** The hero: the restaurant's backdrop with its dish, and a card with its name and terms. */
function Hero(handle: Handle<{ restaurant: Restaurant }>) {
	return () => {
		let { restaurant } = handle.props;
		let cuisine = findCuisine(restaurant.cuisine);
		return (
			<div mix={[raw({ position: "relative" })]}>
				<div mix={[raw({ blockSize: "clamp(10rem, 22vw, 15rem)" })]}>
					<Backdrop restaurant={restaurant}>
						<span
							mix={[
								raw({
									position: "absolute",
									insetInlineEnd: "max(6%, 1rem)",
									insetBlockStart: "50%",
									translate: "0 -50%",
									inlineSize: "clamp(8rem, 18vw, 13rem)",
									rotate: "-8deg",
								}),
							]}
						>
							<DishArt dish={restaurant.dish} />
						</span>
					</Backdrop>
				</div>
				<Gutter>
					<div
						mix={[
							raw({
								position: "relative",
								display: "grid",
								gap: "0.5rem",
								marginBlockStart: "-3.5rem",
								maxInlineSize: "40rem",
								padding: "1.25rem 1.25rem 1.125rem",
								borderRadius: CARD_RADIUS,
								backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
								boxShadow:
									"0 0 0 1px var(--ui-neutral-border), 0 18px 40px -24px rgb(40 10 20 / 0.35)",
							}),
						]}
					>
						<a
							href={href()}
							data-main-scroll-top=""
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.125rem",
									justifySelf: "start",
									fontSize: "0.8125rem",
									fontWeight: "650",
									color: "var(--ui-neutral-fg-muted)",
									textDecoration: "none",
								}),
								when("&:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
							]}
						>
							<ChevronLeftIcon aria-hidden="true" size={15} />
							All restaurants
						</a>
						<h1
							mix={[
								raw({
									margin: "0",
									fontSize: "clamp(1.625rem, 1.3rem + 1.2vw, 2.25rem)",
									fontWeight: "800",
									letterSpacing: "-0.03em",
									lineHeight: "1.1",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{restaurant.name}
						</h1>
						<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg)" })]}>
							{cuisine?.name} · {"$".repeat(restaurant.price)} · {restaurant.blurb}
						</p>
						<RestaurantFacts restaurant={restaurant} />
						<p
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									gap: "0.375rem 1rem",
									margin: "0",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.25rem" })]}>
								<MapPinIcon aria-hidden="true" size={13} />
								{restaurant.street} · {restaurant.distance.toFixed(1)} km
							</span>
							{restaurant.promo === undefined ? null : (
								<span
									mix={[
										raw({
											paddingInline: "0.5rem",
											paddingBlock: "0.125rem",
											borderRadius: "999px",
											fontWeight: "700",
											color: "var(--ui-brand-fg)",
											backgroundColor: "var(--ui-brand-bg-subtle)",
										}),
									]}
								>
									{restaurant.promo}
								</span>
							)}
						</p>
					</div>
				</Gutter>
			</div>
		);
	};
}

/** A notice above the menu: tinted, with an icon, for a closed kitchen or a cart elsewhere. */
function Notice(handle: Handle<{ tone: "info" | "warning"; children: string }>) {
	return () => (
		<p
			role="note"
			mix={[
				raw({
					display: "flex",
					alignItems: "start",
					gap: "0.625rem",
					margin: "1.25rem 0 0",
					padding: "0.75rem 1rem",
					borderRadius: "0.875rem",
					fontSize: "0.9375rem",
					lineHeight: "1.45",
					color:
						handle.props.tone === "warning"
							? "var(--ui-warning-fg, var(--ui-neutral-fg))"
							: "var(--ui-neutral-fg)",
					backgroundColor:
						handle.props.tone === "warning"
							? "var(--ui-warning-bg-subtle, var(--ui-neutral-bg-subtle))"
							: "var(--ui-neutral-bg-subtle)",
				}),
			]}
		>
			{handle.props.tone === "warning" ? (
				<TriangleAlertIcon
					aria-hidden="true"
					size={18}
					mix={[raw({ flexShrink: "0", marginBlockStart: "0.125rem" })]}
				/>
			) : (
				<InfoIcon
					aria-hidden="true"
					size={18}
					mix={[raw({ flexShrink: "0", marginBlockStart: "0.125rem" })]}
				/>
			)}
			{handle.props.children}
		</p>
	);
}

/** A dish on the menu: the whole card opens its dialog, with a round + over its picture. */
function DishCard(handle: Handle<{ restaurant: Restaurant; entry: MenuItem; closed: boolean }>) {
	return () => {
		let { closed, entry, restaurant } = handle.props;
		return (
			<li
				id={`dish-${entry.id}`}
				mix={[
					raw({ scrollMarginBlockStart: `calc(${TOP_BAR} + ${SECTION_BAR_BLOCK_SIZE} + 1rem)` }),
				]}
			>
				<button
					type="button"
					commandfor={dialogId(entry)}
					command="show-modal"
					aria-haspopup="dialog"
					data-dish-card={entry.id}
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr) 6.5rem",
							gap: "1rem",
							inlineSize: "100%",
							blockSize: "100%",
							padding: "1rem",
							boxSizing: "border-box",
							border: "0",
							borderRadius: CARD_RADIUS,
							font: "inherit",
							textAlign: "start",
							color: "inherit",
							backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
							boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							cursor: "pointer",
							transition: "box-shadow 160ms ease, background-color 160ms ease",
						}),
						when(
							"&:hover",
							raw({
								boxShadow:
									"inset 0 0 0 1px var(--ui-neutral-border-strong, var(--ui-neutral-fg-subtle))",
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
								raw({
									fontSize: "1rem",
									fontWeight: "700",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{entry.name}
						</span>
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
							{entry.description}
						</span>
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
								{entry.groups.length > 0 &&
								itemGroups(restaurant, entry).some(
									(group) => group.required && group.choices.some((choice) => choice.price > 0),
								)
									? "From "
									: ""}
								{money(entry.price)}
							</span>
							{entry.popular ? (
								<span
									mix={[
										raw({ fontSize: "0.75rem", fontWeight: "700", color: "var(--ui-brand-fg)" }),
									]}
								>
									Popular
								</span>
							) : null}
							{entry.tag === undefined ? null : <DishTag tag={entry.tag} />}
						</span>
					</span>
					<span
						mix={[
							raw({
								position: "relative",
								alignSelf: "start",
								inlineSize: "6.5rem",
								blockSize: "6.5rem",
								padding: "0.5rem",
								boxSizing: "border-box",
								borderRadius: "0.875rem",
								backgroundColor: restaurant.tones[0],
							}),
						]}
					>
						<DishArt dish={entry.dish} />
						{closed ? null : (
							<span
								aria-hidden="true"
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
				</button>
			</li>
		);
	};
}

/** One option group as a fieldset: radios for a required pick, checkboxes for extras. */
function GroupField(handle: Handle<{ group: OptionGroup; restaurant: Restaurant }>) {
	return () => {
		let { group } = handle.props;
		let hint = iife(() => {
			if (group.required) return "Pick one";
			return group.max === 1 ? "Optional, pick one" : `Optional, up to ${group.max}`;
		});
		return (
			<fieldset
				data-max={group.required ? undefined : String(group.max)}
				mix={[raw({ margin: "0", padding: "0", border: "0", display: "grid", gap: "0.25rem" })]}
			>
				<legend
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.75rem",
							inlineSize: "100%",
							padding: "0",
							marginBlockEnd: "0.375rem",
						}),
					]}
				>
					<span mix={[raw({ display: "grid", gap: "0.0625rem" })]}>
						<span
							mix={[
								raw({
									fontSize: "1rem",
									fontWeight: "750",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{group.name}
						</span>
						<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{hint}
						</span>
					</span>
					{group.required ? (
						<span
							mix={[
								raw({
									paddingInline: "0.5rem",
									paddingBlock: "0.125rem",
									borderRadius: "999px",
									fontSize: "0.75rem",
									fontWeight: "700",
									color: "var(--ui-neutral-fg-on-solid)",
									backgroundColor: "var(--ui-neutral-bg-solid)",
								}),
							]}
						>
							Required
						</span>
					) : null}
				</legend>
				{group.choices.map((choice, index) => (
					<label
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "1.25rem minmax(0, 1fr) auto",
								alignItems: "center",
								gap: "0.75rem",
								minBlockSize: "2.75rem",
								paddingInline: "0.25rem",
								borderBlockEnd:
									"1px solid var(--ui-neutral-border-subtle, var(--ui-neutral-border))",
								cursor: "pointer",
								"&:has(input:disabled)": { opacity: "0.5", cursor: "not-allowed" },
								"& input": {
									inlineSize: "1.125rem",
									blockSize: "1.125rem",
									margin: "0",
									accentColor: "var(--ui-color-brand-600)",
								},
							}),
						]}
					>
						<input
							type={group.required ? "radio" : "checkbox"}
							name={`g.${group.id}`}
							value={choice.id}
							data-price={String(choice.price)}
							required={group.required && index === 0 ? true : undefined}
						/>
						<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>{choice.name}</span>
						<span
							mix={[
								raw({
									fontSize: "0.875rem",
									fontVariantNumeric: "tabular-nums",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{choice.price === 0 ? "" : `+${money(choice.price)}`}
						</span>
					</label>
				))}
			</fieldset>
		);
	};
}

namespace ItemDialog {
	export interface Props {
		restaurant: Restaurant;
		entry: MenuItem;
		visitor: Visitor;
		/** The page the post returns to. */
		back: string;
	}
}

/**
 * A dish's dialog: its picture, description and every option group, a quantity, and the add
 * button carrying the running price. A cart from another restaurant is named above the button,
 * which then reads "Start a new cart", and the post replaces that cart.
 */
function ItemDialog(handle: Handle<ItemDialog.Props>) {
	return () => {
		let { back, entry, restaurant, visitor } = handle.props;
		let id = dialogId(entry);
		let other =
			visitor.cart !== undefined && visitor.cart.restaurant.id !== restaurant.id
				? visitor.cart
				: undefined;
		let closed = restaurant.opensAt !== undefined;
		return (
			<dialog
				id={id}
				closedby="any"
				aria-labelledby={`${id}-title`}
				mix={[
					raw({
						inlineSize: "100%",
						maxInlineSize: "100%",
						maxBlockSize: "92dvh",
						margin: "auto auto 0",
						padding: "0",
						border: "0",
						borderRadius: "1.25rem 1.25rem 0 0",
						color: "var(--ui-neutral-fg)",
						backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
						boxShadow: "0 -12px 40px -12px rgb(0 0 0 / 0.35)",
						overflow: "hidden",
						"&::backdrop": { backgroundColor: "rgb(20 8 14 / 0.5)", backdropFilter: "blur(2px)" },
						"&[open]": { display: "flex", flexDirection: "column" },
						"@keyframes bocado-sheet-in": {
							from: { translate: "0 2rem", opacity: "0" },
							to: { translate: "0 0", opacity: "1" },
						},
						"&[open]:modal": { animation: "bocado-sheet-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)" },
						[`@media ${WIDE}`]: {
							inlineSize: "min(34rem, calc(100vw - 2rem))",
							maxBlockSize: "min(88dvh, 52rem)",
							margin: "auto",
							borderRadius: "1.25rem",
						},
					}),
					motionReduce(raw({ "&[open]:modal": { animation: "none" } })),
				]}
			>
				<form
					method="post"
					action={actionHref("cart/add")}
					data-item-form=""
					data-base={String(entry.price)}
					mix={[
						raw({ display: "flex", flexDirection: "column", minBlockSize: "0", flex: "1 1 auto" }),
					]}
				>
					<input type="hidden" name="restaurant" value={restaurant.id} />
					<input type="hidden" name="item" value={entry.id} />
					<input type="hidden" name="back" value={back} />
					{other === undefined ? null : <input type="hidden" name="replace" value="1" />}
					<div mix={[raw({ overflowY: "auto", overscrollBehavior: "contain", flex: "1 1 auto" })]}>
						<div
							mix={[
								raw({
									position: "relative",
									display: "grid",
									placeItems: "center",
									blockSize: "11rem",
									backgroundColor: restaurant.tones[0],
								}),
							]}
						>
							<span mix={[raw({ inlineSize: "9rem" })]}>
								<DishArt dish={entry.dish} />
							</span>
							<button
								type="button"
								commandfor={id}
								command="close"
								aria-label="Close"
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "0.75rem",
										insetInlineEnd: "0.75rem",
										display: "grid",
										placeItems: "center",
										inlineSize: "2.5rem",
										blockSize: "2.5rem",
										padding: "0",
										border: "0",
										borderRadius: "999px",
										color: "oklch(0.25 0.03 40)",
										backgroundColor: "rgb(255 255 255 / 0.85)",
										cursor: "pointer",
									}),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
								]}
							>
								<XIcon aria-hidden="true" size={18} />
							</button>
						</div>
						<div mix={[raw({ display: "grid", gap: "1.5rem", padding: "1.25rem 1.25rem 1.5rem" })]}>
							<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
								<h2
									id={`${id}-title`}
									mix={[
										raw({
											margin: "0",
											fontSize: "1.375rem",
											fontWeight: "800",
											letterSpacing: "-0.02em",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									{entry.name}
								</h2>
								<p mix={[raw({ margin: "0", lineHeight: "1.5" })]}>{entry.description}</p>
								<p
									mix={[
										raw({
											display: "flex",
											gap: "0.5rem",
											alignItems: "center",
											margin: "0",
											fontWeight: "650",
										}),
									]}
								>
									{money(entry.price)}
									{entry.tag === undefined ? null : <DishTag tag={entry.tag} />}
								</p>
							</div>
							{itemGroups(restaurant, entry).map((group) => (
								<GroupField group={group} restaurant={restaurant} />
							))}
							<label
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "1rem",
									}),
								]}
							>
								<span mix={[raw({ fontWeight: "750", color: "var(--ui-neutral-fg-emphasis)" })]}>
									Quantity
								</span>
								<input
									type="number"
									name="qty"
									value="1"
									min="1"
									max="20"
									inputmode="numeric"
									mix={[
										raw({
											inlineSize: "5rem",
											blockSize: "2.5rem",
											paddingInline: "0.75rem",
											boxSizing: "border-box",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "0.75rem",
											font: "inherit",
											fontWeight: "700",
											textAlign: "center",
											color: "var(--ui-neutral-fg-emphasis)",
											backgroundColor: "var(--ui-bg)",
										}),
										when(
											"&:focus",
											raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
										),
									]}
								/>
							</label>
						</div>
					</div>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "0.625rem",
								padding: "0.875rem 1.25rem calc(0.875rem + env(safe-area-inset-bottom, 0px))",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
								backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
							}),
						]}
					>
						{other === undefined ? null : (
							<p
								data-cart-conflict=""
								mix={[
									raw({
										display: "flex",
										gap: "0.5rem",
										margin: "0",
										fontSize: "0.875rem",
										lineHeight: "1.4",
										color: "var(--ui-warning-fg, var(--ui-neutral-fg))",
									}),
								]}
							>
								<TriangleAlertIcon
									aria-hidden="true"
									size={17}
									mix={[raw({ flexShrink: "0", marginBlockStart: "0.0625rem" })]}
								/>
								Your cart holds {lineCount(other.lines)} from {other.restaurant.name}. Adding this
								starts a new cart from {restaurant.name}.
							</p>
						)}
						<button
							type="submit"
							disabled={closed}
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "1rem",
									inlineSize: "100%",
									blockSize: "3.25rem",
									paddingInline: "1.25rem",
									border: "0",
									borderRadius: "999px",
									font: "inherit",
									fontSize: "1rem",
									fontWeight: "750",
									color: "var(--ui-brand-fg-on-solid, white)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									cursor: "pointer",
								}),
								when(
									"&:hover",
									raw({
										backgroundColor: "var(--ui-brand-bg-solid-hover, var(--ui-brand-bg-solid))",
									}),
								),
								when(
									"&:focus-visible",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
								when("&:disabled", raw({ opacity: "0.5", cursor: "not-allowed" })),
							]}
						>
							<span>
								{iife(() => {
									if (closed) return `Opens at ${restaurant.opensAt}`;
									return other === undefined ? "Add " : "Start a new cart with ";
								})}
								{closed ? null : <span data-item-qty="">1</span>}
								{closed || other !== undefined ? null : " to cart"}
							</span>
							<span data-item-total="" mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
								{money(entry.price)}
							</span>
						</button>
					</div>
				</form>
			</dialog>
		);
	};
}

namespace RestaurantPage {
	export interface Props {
		restaurant: Restaurant;
		visitor: Visitor;
		/** The page's own path, which its posts return to. */
		back: string;
	}
}

/**
 * Renders a restaurant: hero, notices, the sticky category bar and the menu, with the cart
 * beside it on a wide screen.
 */
export default function RestaurantPage(handle: Handle<RestaurantPage.Props>) {
	return () => {
		let { back, restaurant, visitor } = handle.props;
		let closed = restaurant.opensAt !== undefined;
		let other =
			visitor.cart !== undefined && visitor.cart.restaurant.id !== restaurant.id
				? visitor.cart
				: undefined;
		let items = restaurant.sections.map((section) => ({
			id: `menu-${section.id}`,
			label: section.name,
			count: section.items.length,
		}));
		return (
			<>
				<Hero restaurant={restaurant} />
				<Gutter>
					{closed ? (
						<Notice tone="info">{`${restaurant.name} opens at ${restaurant.opensAt}. Browse the menu now and order once the kitchen opens.`}</Notice>
					) : null}
					{other === undefined ? null : (
						<Notice tone="warning">{`Your cart holds ${lineCount(other.lines)} from ${other.restaurant.name}. A cart orders from one restaurant, so adding a dish here starts a new one.`}</Notice>
					)}
				</Gutter>
				<SectionBar
					id="bocado-menu-bar"
					label="Menu categories"
					items={items}
					top={TOP_BAR}
					mix={[
						raw({
							marginBlockStart: "1.5rem",
							"--ui-section-bar-inset": `max(${GUTTER}, calc((100vw - 78rem) / 2 + ${GUTTER}))`,
						}),
					]}
				/>
				<Gutter>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "2rem",
								paddingBlockStart: "1.5rem",
								"@media (min-width: 64rem)": {
									gridTemplateColumns: "minmax(0, 1fr) 21rem",
									alignItems: "start",
								},
							}),
						]}
					>
						<div mix={[raw({ display: "grid", gap: "2.25rem" })]}>
							{restaurant.sections.map((section) => (
								<section
									id={`menu-${section.id}`}
									aria-labelledby={`menu-${section.id}-title`}
									mix={[
										raw({
											scrollMarginBlockStart: `calc(${TOP_BAR} + ${SECTION_BAR_BLOCK_SIZE} + 0.75rem)`,
										}),
									]}
								>
									<h2
										id={`menu-${section.id}-title`}
										mix={[
											raw({
												margin: "0 0 0.875rem",
												fontSize: "1.3125rem",
												fontWeight: "800",
												letterSpacing: "-0.02em",
												color: "var(--ui-neutral-fg-emphasis)",
											}),
										]}
									>
										{section.name}
									</h2>
									<ul
										mix={[
											raw({
												display: "grid",
												gridTemplateColumns: "repeat(auto-fill, minmax(min(21rem, 100%), 1fr))",
												gap: "0.875rem",
												margin: "0",
												padding: "0",
												listStyle: "none",
											}),
										]}
									>
										{section.items.map((entry) => (
											<DishCard restaurant={restaurant} entry={entry} closed={closed} />
										))}
									</ul>
								</section>
							))}
						</div>
						<aside
							aria-label="Your cart"
							mix={[
								raw({
									display: "none",
									"@media (min-width: 64rem)": {
										display: "block",
										position: "sticky",
										insetBlockStart: `calc(${TOP_BAR} + ${SECTION_BAR_BLOCK_SIZE} + 1.5rem)`,
										padding: "1.125rem",
										borderRadius: CARD_RADIUS,
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
									},
								}),
							]}
						>
							<h2 mix={[raw({ margin: "0 0 0.25rem", fontSize: "1.0625rem", fontWeight: "800" })]}>
								Your cart
							</h2>
							<CartPanel cart={visitor.cart} back={back} compact />
						</aside>
					</div>
				</Gutter>
				{restaurant.sections.flatMap((section) =>
					section.items.map((entry) => (
						<ItemDialog restaurant={restaurant} entry={entry} visitor={visitor} back={back} />
					)),
				)}
				<ItemLive />
			</>
		);
	};
}
