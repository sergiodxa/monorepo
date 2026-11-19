/**
 * The pieces Bocado's screens share: the page gutter, restaurant cards and rows, cuisine
 * chips, the rating line, the quantity stepper whose buttons are form posts, and the cart
 * panel the top bar's popover and the cart page both draw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ClockIcon, MinusIcon, PlusIcon, ShoppingBagIcon, StarIcon, TrashIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Badge, LinkButton } from "@sdxc/ui";

import type { Cuisine, Line, Restaurant } from "./data";
import type { Cart } from "./state";

import { Backdrop, DishArt } from "./art";
import {
	CUISINES,
	actionHref,
	deliveryFee,
	etaLabel,
	findCuisine,
	findItem,
	href,
	money,
	reviewCount,
} from "./data";
import { MAX_QTY, choiceSummary, lineCount, lineTotal } from "./state";

/** From here the top bar shows search and Orders, and the tab bar goes. */
export const WIDE = "(min-width: 48rem)";

/** The top bar's height, which the sticky menu bar sits under. */
export const TOP_BAR = "4rem";

/** The page gutter. */
export const GUTTER = "clamp(1rem, 4vw, 2.5rem)";

/** The widest the content runs. */
export const CONTENT_MAX = "78rem";

/** The radius every card and panel shares. */
export const CARD_RADIUS = "1rem";

/** Centres a screen's content at its widest, inside the page gutter. */
export function Gutter(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: CONTENT_MAX,
					marginInline: "auto",
					paddingInline: GUTTER,
					boxSizing: "border-box",
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

namespace ShelfHeading {
	export interface Props {
		title: string;
		/** A short line under the title. */
		note?: string;
		/** A link at the end, such as "See all". */
		action?: RemixNode;
		/** The heading's id, which the shelf names itself by. */
		id?: string;
	}
}

/** A shelf's heading: a bold title, an optional note, and a link at the end. */
export function ShelfHeading(handle: Handle<ShelfHeading.Props>) {
	return () => {
		let { action, id, note, title } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "end",
						justifyContent: "space-between",
						gap: "1rem",
						marginBlockEnd: "0.875rem",
					}),
				]}
			>
				<div mix={[raw({ display: "grid", gap: "0.125rem" })]}>
					<h2
						id={id}
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1.125rem, 1rem + 0.5vw, 1.375rem)",
								fontWeight: "750",
								letterSpacing: "-0.01em",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{title}
					</h2>
					{note === undefined ? null : (
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							{note}
						</p>
					)}
				</div>
				{action}
			</div>
		);
	};
}

/** A restaurant's rating as a filled star, the score and how many reviews it rests on. */
export function Rating(handle: Handle<{ restaurant: Restaurant; reviews?: boolean }>) {
	return () => {
		let { restaurant, reviews = true } = handle.props;
		return (
			<span
				aria-label={`Rated ${restaurant.rating} out of 5 from ${restaurant.reviews} reviews`}
				mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.25rem" })]}
			>
				<StarIcon
					aria-hidden="true"
					size={14}
					mix={[raw({ color: "oklch(0.75 0.16 70)", fill: "oklch(0.8 0.16 80)" })]}
				/>
				<span
					aria-hidden="true"
					mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}
				>
					{restaurant.rating.toFixed(1)}
				</span>
				{reviews ? (
					<span aria-hidden="true" mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
						({reviewCount(restaurant.reviews)})
					</span>
				) : null}
			</span>
		);
	};
}

/** The facts under a restaurant's name: rating, delivery time and fee, dot-separated. */
export function RestaurantFacts(handle: Handle<{ restaurant: Restaurant }>) {
	return () => {
		let { restaurant } = handle.props;
		let dot = (
			<span aria-hidden="true" mix={[raw({ color: "var(--ui-neutral-fg-subtle)" })]}>
				·
			</span>
		);
		return (
			<span
				mix={[
					raw({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						columnGap: "0.375rem",
						rowGap: "0.125rem",
						fontSize: "0.875rem",
						color: "var(--ui-neutral-fg)",
					}),
				]}
			>
				<Rating restaurant={restaurant} />
				{dot}
				<span>{etaLabel(restaurant)}</span>
				{dot}
				<span
					mix={[
						restaurant.fee === 0
							? raw({ color: "var(--ui-success-fg, oklch(0.5 0.13 150))", fontWeight: "600" })
							: raw({}),
					]}
				>
					{deliveryFee(restaurant)}
				</span>
			</span>
		);
	};
}

/** The look every card link shares: no underline, a lift on hover and a ring on focus. */
function cardLink() {
	return [
		raw({
			display: "grid",
			gap: "0.625rem",
			color: "inherit",
			textDecoration: "none",
			borderRadius: CARD_RADIUS,
			"& [data-card-art]": { transition: "transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1)" },
		}),
		when("&:hover [data-card-art]", raw({ transform: "translateY(-2px) scale(1.01)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "4px" }),
		),
		motionReduce(raw({ "& [data-card-art]": { transition: "none" } })),
	];
}

namespace RestaurantCard {
	export interface Props {
		restaurant: Restaurant;
		/** `wide` for a shelf's 16:9 card, `grid` for the grid's 3:2 card. Default: `grid`. */
		shape?: "wide" | "grid";
	}
}

/**
 * A restaurant as a card: its dish over its tinted backdrop with any promotion pinned on, then
 * its name and facts. A restaurant that opens later is greyed with the hour it opens.
 */
export function RestaurantCard(handle: Handle<RestaurantCard.Props>) {
	return () => {
		let { restaurant, shape = "grid" } = handle.props;
		let closed = restaurant.opensAt !== undefined;
		return (
			<a
				href={href(`r/${restaurant.id}`)}
				data-rmx-prefetch="intent"
				data-main-scroll-top=""
				data-restaurant-card={restaurant.id}
				mix={cardLink()}
			>
				<span
					data-card-art=""
					mix={[
						raw({
							position: "relative",
							display: "block",
							aspectRatio: shape === "wide" ? "16 / 9" : "3 / 2",
							overflow: "clip",
							borderRadius: CARD_RADIUS,
							boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.05)",
						}),
					]}
				>
					<Backdrop restaurant={restaurant}>
						<span
							mix={[
								raw({
									inlineSize: "48%",
									maxInlineSize: "9rem",
									filter: closed ? "grayscale(0.85) opacity(0.7)" : "none",
								}),
							]}
						>
							<DishArt dish={restaurant.dish} />
						</span>
					</Backdrop>
					{restaurant.promo === undefined ? null : (
						<span
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "0.625rem",
									insetInlineStart: "0.625rem",
									paddingInline: "0.625rem",
									paddingBlock: "0.25rem",
									borderRadius: "999px",
									fontSize: "0.75rem",
									fontWeight: "700",
									color: "var(--ui-brand-fg-on-solid, white)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									boxShadow: "0 2px 8px -2px rgb(0 0 0 / 0.25)",
								}),
							]}
						>
							{restaurant.promo}
						</span>
					)}
					{closed ? (
						<span
							mix={[
								raw({
									position: "absolute",
									inset: "auto 0.625rem 0.625rem auto",
									display: "inline-flex",
									alignItems: "center",
									gap: "0.25rem",
									paddingInline: "0.625rem",
									paddingBlock: "0.25rem",
									borderRadius: "999px",
									fontSize: "0.75rem",
									fontWeight: "650",
									color: "white",
									backgroundColor: "rgb(20 16 18 / 0.78)",
								}),
							]}
						>
							<ClockIcon aria-hidden="true" size={12} />
							Opens {restaurant.opensAt}
						</span>
					) : null}
				</span>
				<span mix={[raw({ display: "grid", gap: "0.1875rem", paddingInline: "0.125rem" })]}>
					<span
						mix={[
							raw({
								fontSize: "1rem",
								fontWeight: "700",
								color: "var(--ui-neutral-fg-emphasis)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}),
						]}
					>
						{restaurant.name}
					</span>
					<RestaurantFacts restaurant={restaurant} />
				</span>
			</a>
		);
	};
}

/** A grid of restaurant cards that fills the row, two across on a phone. */
export function RestaurantGrid(handle: Handle<{ restaurants: Restaurant[] }>) {
	return () => (
		<ul
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(min(15rem, 100%), 1fr))",
					gap: "1.75rem 1.25rem",
					margin: "0",
					padding: "0",
					listStyle: "none",
				}),
			]}
		>
			{handle.props.restaurants.map((restaurant) => (
				<li>
					<RestaurantCard restaurant={restaurant} />
				</li>
			))}
		</ul>
	);
}

namespace CuisineChips {
	export interface Props {
		/** The cuisine marked current, or none. */
		current?: Cuisine;
		/** The address a chip leads to for a cuisine, or for none. */
		hrefFor: (cuisine: Cuisine | undefined) => string;
		/** Draws each chip's dish above its name, as home does; search draws plain pills. */
		pictures?: boolean;
	}
}

/**
 * Every cuisine as a chip that filters by it; the current one is filled and leads back to
 * all of them. On home each chip carries its dish, on search it is a plain pill.
 */
export function CuisineChips(handle: Handle<CuisineChips.Props>) {
	return () => {
		let { current, hrefFor, pictures = false } = handle.props;
		return (
			<ul
				aria-label="Cuisines"
				mix={[
					raw({
						display: "flex",
						gap: pictures ? "0.5rem" : "0.375rem",
						margin: "0",
						marginInline: `calc(-1 * ${GUTTER})`,
						paddingInline: GUTTER,
						paddingBlock: "0.25rem",
						listStyle: "none",
						overflowX: "auto",
						scrollbarWidth: "none",
						scrollSnapType: "x proximity",
						scrollPaddingInline: GUTTER,
						"&::-webkit-scrollbar": { display: "none" },
					}),
				]}
			>
				{CUISINES.map((cuisine) => {
					let on = current?.id === cuisine.id;
					return (
						<li mix={[raw({ flexShrink: "0", scrollSnapAlign: "start" })]}>
							<a
								href={hrefFor(on ? undefined : cuisine)}
								aria-current={on ? "true" : undefined}
								data-cuisine={cuisine.id}
								mix={[
									pictures
										? raw({
												display: "grid",
												justifyItems: "center",
												gap: "0.375rem",
												inlineSize: "5.25rem",
												paddingBlock: "0.625rem 0.5rem",
												borderRadius: CARD_RADIUS,
												fontSize: "0.8125rem",
												fontWeight: "600",
												"& svg": { inlineSize: "2.75rem", blockSize: "2.75rem" },
											})
										: raw({
												display: "inline-flex",
												alignItems: "center",
												blockSize: "2.25rem",
												paddingInline: "0.875rem",
												borderRadius: "999px",
												fontSize: "0.875rem",
												fontWeight: "600",
												boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
											}),
									raw({
										color: "var(--ui-neutral-fg-emphasis)",
										textDecoration: "none",
										whiteSpace: "nowrap",
										transition: "background-color 140ms ease",
									}),
									when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
									when(
										"&[aria-current='true']",
										raw({
											color: "var(--ui-brand-fg-on-solid, white)",
											backgroundColor: "var(--ui-brand-bg-solid)",
											boxShadow: "none",
										}),
									),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
									motionReduce(raw({ transition: "none" })),
								]}
							>
								{pictures ? <DishArt dish={cuisine.dish} /> : null}
								{cuisine.name}
							</a>
						</li>
					);
				})}
			</ul>
		);
	};
}

/** The look of a stepper's round button. */
function stepButton() {
	return [
		raw({
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "2rem",
			blockSize: "2rem",
			padding: "0",
			border: "0",
			borderRadius: "999px",
			color: "var(--ui-neutral-fg-emphasis)",
			backgroundColor: "var(--ui-neutral-bg-subtle)",
			cursor: "pointer",
		}),
		when(
			"&:hover",
			raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover, var(--ui-neutral-bg-muted))" }),
		),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
		),
		when("&:disabled", raw({ opacity: "0.4", cursor: "not-allowed" })),
	];
}

namespace LineStepper {
	export interface Props {
		/** The line's place in the cart. */
		index: number;
		line: Line;
		name: string;
		/** The page the post returns to. */
		back: string;
	}
}

/**
 * A cart line's − count + control. Each button is a post naming the new count, so it works
 * without script; at one, − becomes a bin that removes the line.
 */
export function LineStepper(handle: Handle<LineStepper.Props>) {
	return () => {
		let { back, index, line, name } = handle.props;
		return (
			<form
				method="post"
				action={actionHref("cart/line")}
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.25rem",
						padding: "0.125rem",
						borderRadius: "999px",
						boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
					}),
				]}
			>
				<input type="hidden" name="line" value={String(index)} />
				<input type="hidden" name="back" value={back} />
				<button
					type="submit"
					name="qty"
					value={String(line.qty - 1)}
					aria-label={line.qty === 1 ? `Remove ${name}` : `One fewer ${name}`}
					mix={stepButton()}
				>
					{line.qty === 1 ? (
						<TrashIcon aria-hidden="true" size={15} />
					) : (
						<MinusIcon aria-hidden="true" size={15} />
					)}
				</button>
				<output
					aria-label={`${line.qty} of ${name}`}
					mix={[
						raw({
							minInlineSize: "1.5rem",
							textAlign: "center",
							fontWeight: "700",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					{line.qty}
				</output>
				<button
					type="submit"
					name="qty"
					value={String(line.qty + 1)}
					aria-label={`One more ${name}`}
					disabled={line.qty >= MAX_QTY}
					mix={stepButton()}
				>
					<PlusIcon aria-hidden="true" size={15} />
				</button>
			</form>
		);
	};
}

/** One cart line: the dish's art, name, picks and price, and its stepper. */
export function CartLine(handle: Handle<{ cart: Cart; line: Line; index: number; back: string }>) {
	return () => {
		let { back, cart, index, line } = handle.props;
		let entry = findItem(cart.restaurant, line.item);
		if (entry === undefined) return null;
		let picks = choiceSummary(cart.restaurant, line);
		return (
			<li
				data-cart-line={line.item}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "3rem minmax(0, 1fr) auto",
						alignItems: "center",
						gap: "0.75rem",
						paddingBlock: "0.75rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border-subtle, var(--ui-neutral-border))",
					}),
				]}
			>
				<span
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							inlineSize: "3rem",
							blockSize: "3rem",
							borderRadius: "0.75rem",
							backgroundColor: cart.restaurant.tones[0],
							padding: "0.25rem",
							boxSizing: "border-box",
						}),
					]}
				>
					<DishArt dish={entry.dish} />
				</span>
				<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
					<span mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}>
						{entry.name}
					</span>
					{picks === "" ? null : (
						<span
							mix={[
								raw({
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
									lineHeight: "1.35",
								}),
							]}
						>
							{picks}
						</span>
					)}
					<span
						mix={[
							raw({ fontSize: "0.875rem", fontWeight: "600", fontVariantNumeric: "tabular-nums" }),
						]}
					>
						{money(lineTotal(cart.restaurant, line))}
					</span>
				</span>
				<LineStepper index={index} line={line} name={entry.name} back={back} />
			</li>
		);
	};
}

namespace CartPanel {
	export interface Props {
		cart: Cart | undefined;
		/** The page the cart's posts return to. */
		back: string;
		/** Draws the restaurant's name as a link and the checkout button; the cart page draws its own. */
		compact?: boolean;
	}
}

/**
 * The cart: which restaurant it orders from, every line with its stepper, the subtotal and
 * the way to checkout. An empty cart says so and points back to the restaurants.
 */
export function CartPanel(handle: Handle<CartPanel.Props>) {
	return () => {
		let { back, cart, compact = false } = handle.props;
		if (cart === undefined) {
			return (
				<div
					mix={[
						raw({
							display: "grid",
							justifyItems: "center",
							gap: "0.5rem",
							paddingBlock: "2rem",
							textAlign: "center",
						}),
					]}
				>
					<ShoppingBagIcon
						aria-hidden="true"
						size={36}
						mix={[raw({ color: "var(--ui-neutral-fg-subtle)" })]}
					/>
					<p
						mix={[raw({ margin: "0", fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}
					>
						Your cart is empty
					</p>
					<p
						mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						Add a dish from any restaurant and it waits here.
					</p>
				</div>
			);
		}
		let subtotal = cart.lines.reduce((sum, line) => sum + lineTotal(cart.restaurant, line), 0);
		let cuisine = findCuisine(cart.restaurant.cuisine);
		return (
			<div mix={[raw({ display: "grid", gap: "0.5rem" })]}>
				{compact ? (
					<a
						href={href(`r/${cart.restaurant.id}`)}
						mix={[
							raw({
								display: "grid",
								gap: "0.125rem",
								color: "inherit",
								textDecoration: "none",
							}),
							when("&:hover span:first-child", raw({ textDecoration: "underline" })),
						]}
					>
						<span
							mix={[
								raw({
									fontSize: "1.0625rem",
									fontWeight: "750",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{cart.restaurant.name}
						</span>
						<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{cuisine?.name} · {etaLabel(cart.restaurant)}
						</span>
					</a>
				) : null}
				<ul mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
					{cart.lines.map((line, index) => (
						<CartLine cart={cart} line={line} index={index} back={back} />
					))}
				</ul>
				<div
					mix={[
						raw({
							display: "flex",
							justifyContent: "space-between",
							paddingBlock: "0.5rem",
							fontWeight: "650",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					<span>
						Subtotal · {lineCount(cart.lines)} {lineCount(cart.lines) === 1 ? "item" : "items"}
					</span>
					<span>{money(subtotal)}</span>
				</div>
				{compact ? (
					<LinkButton href={href("checkout")} color="brand" size="lg" data-main-scroll-top="">
						Go to checkout · {money(subtotal)}
					</LinkButton>
				) : null}
			</div>
		);
	};
}

/** A dietary tag on a dish, such as "Vegan". */
export function DishTag(handle: Handle<{ tag: string }>) {
	return () => (
		<Badge color={handle.props.tag === "Spicy" ? "danger" : "success"} variant="secondary">
			{handle.props.tag}
		</Badge>
	);
}
