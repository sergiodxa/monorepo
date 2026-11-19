/**
 * Bocado's home: a greeting for the address being delivered to, the cuisines as picture chips,
 * a way back to the last order, sideways shelves picked for this address (fastest, free
 * delivery, top rated) and every restaurant in a grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ChevronRightIcon, RotateCcwIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { Restaurant } from "./data";
import type { Visitor } from "./state";

import { DishArt } from "./art";
import { RESTAURANTS, actionHref, findRestaurant, href, money } from "./data";
import {
	CARD_RADIUS,
	CuisineChips,
	GUTTER,
	Gutter,
	RestaurantCard,
	RestaurantGrid,
	ShelfHeading,
} from "./parts";
import { lineCount, priceLines } from "./state";

/** A "See all" link at a shelf's end. */
function SeeAll(handle: Handle<{ page: string; label: string }>) {
	return () => (
		<a
			href={href(handle.props.page)}
			aria-label={handle.props.label}
			data-main-scroll-top=""
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.125rem",
					flexShrink: "0",
					fontSize: "0.875rem",
					fontWeight: "650",
					color: "var(--ui-brand-fg)",
					textDecoration: "none",
				}),
				when("&:hover", raw({ textDecoration: "underline" })),
			]}
		>
			See all
			<ChevronRightIcon aria-hidden="true" size={16} />
		</a>
	);
}

namespace Shelf {
	export interface Props {
		id: string;
		title: string;
		note?: string;
		restaurants: Restaurant[];
		/** The search screen address that lists the shelf in full. */
		more: string;
	}
}

/** A sideways row of wide restaurant cards that snaps card by card. */
function Shelf(handle: Handle<Shelf.Props>) {
	return () => {
		let { id, more, note, restaurants, title } = handle.props;
		return (
			<section aria-labelledby={id} mix={[raw({ marginBlockStart: "2.5rem" })]}>
				<ShelfHeading
					id={id}
					title={title}
					note={note}
					action={<SeeAll page={more} label={`See all: ${title}`} />}
				/>
				<ul
					mix={[
						raw({
							display: "grid",
							gridAutoFlow: "column",
							gridAutoColumns: "min(19rem, 78%)",
							gap: "1.25rem",
							margin: "0",
							marginInline: `calc(-1 * ${GUTTER})`,
							paddingInline: GUTTER,
							paddingBlock: "0.25rem 0.5rem",
							listStyle: "none",
							overflowX: "auto",
							scrollSnapType: "x mandatory",
							scrollPaddingInline: GUTTER,
							scrollbarWidth: "none",
							"&::-webkit-scrollbar": { display: "none" },
						}),
					]}
				>
					{restaurants.map((restaurant) => (
						<li mix={[raw({ scrollSnapAlign: "start" })]}>
							<RestaurantCard restaurant={restaurant} shape="wide" />
						</li>
					))}
				</ul>
			</section>
		);
	};
}

/**
 * The last order as a card: where it came from, what was in it and a Reorder button that
 * posts it back into the cart.
 */
function OrderAgain(handle: Handle<{ visitor: Visitor }>) {
	return () => {
		let order = handle.props.visitor.orders[0];
		let restaurant = order === undefined ? undefined : findRestaurant(order.restaurant);
		if (order === undefined || restaurant === undefined) return null;
		let totals = priceLines(restaurant, order.lines, { tip: order.tip, priority: order.priority });
		let count = lineCount(order.lines);
		return (
			<section
				aria-labelledby="bocado-again"
				mix={[raw({ marginBlockStart: "2rem", containerType: "inline-size" })]}
			>
				<h2
					id="bocado-again"
					mix={[
						raw({
							position: "absolute",
							inlineSize: "1px",
							blockSize: "1px",
							overflow: "hidden",
							clipPath: "inset(50%)",
						}),
					]}
				>
					Order again
				</h2>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "4rem minmax(0, 1fr) auto",
							alignItems: "center",
							gap: "1rem",
							"@container (max-width: 28rem)": { gap: "0.75rem" },
							padding: "0.875rem 1rem",
							borderRadius: CARD_RADIUS,
							backgroundColor: "var(--ui-neutral-bg-subtle)",
						}),
					]}
				>
					<span
						mix={[
							raw({
								display: "grid",
								placeItems: "center",
								inlineSize: "4rem",
								blockSize: "4rem",
								padding: "0.375rem",
								boxSizing: "border-box",
								borderRadius: "0.875rem",
								backgroundColor: restaurant.tones[0],
							}),
						]}
					>
						<DishArt dish={restaurant.dish} />
					</span>
					<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
						<span
							mix={[
								raw({
									fontSize: "0.75rem",
									fontWeight: "700",
									textTransform: "uppercase",
									letterSpacing: "0.06em",
									color: "var(--ui-brand-fg)",
								}),
							]}
						>
							Order again
						</span>
						<a
							href={href(`r/${restaurant.id}`)}
							data-main-scroll-top=""
							mix={[
								raw({
									fontWeight: "750",
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "none",
								}),
								when("&:hover", raw({ textDecoration: "underline" })),
							]}
						>
							{restaurant.name}
						</a>
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{count} {count === 1 ? "item" : "items"} · {money(totals.total)}
						</span>
					</span>
					<form
						method="post"
						action={actionHref(`orders/${order.id}/reorder`)}
						data-main-scroll-top=""
					>
						<button
							type="submit"
							aria-label={`Reorder from ${restaurant.name}`}
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									blockSize: "2.5rem",
									paddingInline: "1rem",
									border: "0",
									borderRadius: "999px",
									font: "inherit",
									fontWeight: "700",
									color: "var(--ui-brand-fg-on-solid, white)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									cursor: "pointer",
									"@container (max-width: 28rem)": {
										justifyContent: "center",
										inlineSize: "2.5rem",
										paddingInline: "0",
										"& > [data-reorder-label]": { display: "none" },
									},
								}),
								when(
									"&:focus-visible",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
							]}
						>
							<RotateCcwIcon aria-hidden="true" size={16} />
							<span data-reorder-label="">Reorder</span>
						</button>
					</form>
				</div>
			</section>
		);
	};
}

namespace Home {
	export interface Props {
		visitor: Visitor;
	}
}

/** Renders home. */
export default function Home(handle: Handle<Home.Props>) {
	return () => {
		let { visitor } = handle.props;
		let open = RESTAURANTS.filter((restaurant) => restaurant.opensAt === undefined);
		let fastest = [...open].sort((a, b) => a.eta[0] - b.eta[0] || a.eta[1] - b.eta[1]).slice(0, 6);
		let free = RESTAURANTS.filter((restaurant) => restaurant.fee === 0);
		let rated = [...open].sort((a, b) => b.rating - a.rating).slice(0, 6);
		let lead: RemixNode = (
			<div mix={[raw({ display: "grid", gap: "0.25rem", paddingBlock: "1.75rem 1.25rem" })]}>
				<h1
					mix={[
						raw({
							margin: "0",
							fontSize: "clamp(1.625rem, 1.2rem + 1.6vw, 2.375rem)",
							fontWeight: "800",
							letterSpacing: "-0.03em",
							lineHeight: "1.1",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					What are you craving?
				</h1>
				<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
					{RESTAURANTS.length} kitchens deliver to {visitor.address.label}, {visitor.address.line}.
				</p>
			</div>
		);
		return (
			<Gutter>
				{lead}
				<CuisineChips
					pictures
					hrefFor={(cuisine) =>
						href(cuisine === undefined ? "search" : `search?cuisine=${cuisine.id}`)
					}
				/>
				<OrderAgain visitor={visitor} />
				<Shelf
					id="bocado-fastest"
					title={`Fastest to ${visitor.address.label}`}
					note="At your door in 25 minutes or less"
					restaurants={fastest}
					more="search?sort=fastest&fast=1"
				/>
				<Shelf
					id="bocado-free"
					title="Free delivery"
					note="No delivery fee, whatever you order"
					restaurants={free}
					more="search?free=1"
				/>
				<Shelf id="bocado-rated" title="Top rated" restaurants={rated} more="search?sort=rating" />
				<section aria-labelledby="bocado-all" mix={[raw({ marginBlockStart: "2.75rem" })]}>
					<ShelfHeading
						id="bocado-all"
						title="All restaurants"
						note={`${RESTAURANTS.length} near you`}
					/>
					<RestaurantGrid restaurants={RESTAURANTS} />
				</section>
			</Gutter>
		);
	};
}
