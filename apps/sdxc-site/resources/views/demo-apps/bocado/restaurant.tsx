/**
 * A restaurant's page: its hero and delivery terms, a sticky bar of menu categories that
 * follows the scroll, and the menu. Each dish opens a native dialog asking for its required
 * and optional picks, each with its price, and posts the dish into the cart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronLeftIcon, InfoIcon, MapPinIcon, TriangleAlertIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { ItemOptionsDialog } from "@sdxc/ui/commerce/item-options-dialog";
import { MenuItemCard } from "@sdxc/ui/commerce/menu-item-card";
import { OptionGroup } from "@sdxc/ui/commerce/option-group";
import { SECTION_BAR_BLOCK_SIZE, SectionBar } from "@sdxc/ui/section-bar";

import type { MenuItem, Restaurant } from "./data";
import type { Visitor } from "./state";

import { Backdrop, DishArt } from "./art";
import { actionHref, findCuisine, href, itemGroups, money } from "./data";
import { CARD_RADIUS, CartPanel, DishTag, GUTTER, Gutter, RestaurantFacts, TOP_BAR } from "./parts";
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

/** Whether any required pick adds to an item's price, so its card says "From". */
function startsFrom(restaurant: Restaurant, entry: MenuItem): boolean {
	return itemGroups(restaurant, entry).some(
		(group) => group.required && group.choices.some((choice) => choice.price > 0),
	);
}

/** A dish's words and tags after its price: Popular, and a dietary tag. */
function DishBadges(handle: Handle<{ entry: MenuItem }>) {
	return () => {
		let { entry } = handle.props;
		return (
			<>
				{entry.popular ? (
					<span
						mix={[raw({ fontSize: "0.75rem", fontWeight: "700", color: "var(--ui-brand-fg)" })]}
					>
						Popular
					</span>
				) : null}
				{entry.tag === undefined ? null : <DishTag tag={entry.tag} />}
			</>
		);
	};
}

namespace DishDialog {
	export interface Props {
		restaurant: Restaurant;
		entry: MenuItem;
		visitor: Visitor;
		/** The page the post returns to. */
		back: string;
	}
}

/**
 * A dish's options dialog. Each option group posts as `g.<group>`; a cart from another
 * restaurant is named above the button, which then reads "Start a new cart", and the post
 * carries `replace` so the server swaps the cart.
 */
function DishDialog(handle: Handle<DishDialog.Props>) {
	return () => {
		let { back, entry, restaurant, visitor } = handle.props;
		let other =
			visitor.cart !== undefined && visitor.cart.restaurant.id !== restaurant.id
				? visitor.cart
				: undefined;
		let closed = restaurant.opensAt !== undefined;
		let fields: Record<string, string> = { restaurant: restaurant.id, item: entry.id, back };
		if (other !== undefined) fields.replace = "1";
		return (
			<ItemOptionsDialog
				id={dialogId(entry)}
				action={actionHref("cart/add")}
				title={entry.name}
				description={entry.description}
				price={money(entry.price)}
				badges={entry.tag === undefined ? undefined : <DishTag tag={entry.tag} />}
				media={<DishArt dish={entry.dish} />}
				mediaBackground={restaurant.tones[0]}
				base={entry.price}
				currency="USD"
				locale="en-US"
				total={money(entry.price)}
				fields={fields}
				quantity={{ label: "Quantity", max: 20 }}
				disabled={closed}
				closeLabel="Close"
				notice={
					other === undefined ? undefined : (
						<p
							data-cart-conflict=""
							mix={[
								raw({
									display: "flex",
									gap: "0.5rem",
									margin: "0",
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
					)
				}
				submitLabel={iife(() => {
					if (closed) return `Opens at ${restaurant.opensAt}`;
					if (other !== undefined) {
						return (
							<>
								Start a new cart with <span data-options-qty="">1</span>
							</>
						);
					}
					return (
						<>
							Add <span data-options-qty="">1</span> to cart
						</>
					);
				})}
			>
				{itemGroups(restaurant, entry).map((group) => (
					<OptionGroup
						name={`g.${group.id}`}
						title={group.name}
						hint={iife(() => {
							if (group.required) return "Pick one";
							return group.max === 1 ? "Optional, pick one" : `Optional, up to ${group.max}`;
						})}
						required={group.required}
						requiredLabel="Required"
						max={group.max}
						choices={group.choices.map((choice) => ({
							value: choice.id,
							label: choice.name,
							price: choice.price,
							priceLabel: choice.price === 0 ? undefined : `+${money(choice.price)}`,
						}))}
					/>
				))}
			</ItemOptionsDialog>
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
											<li
												id={`dish-${entry.id}`}
												mix={[
													raw({
														scrollMarginBlockStart: `calc(${TOP_BAR} + ${SECTION_BAR_BLOCK_SIZE} + 1rem)`,
													}),
												]}
											>
												<MenuItemCard
													dialog={dialogId(entry)}
													name={entry.name}
													description={entry.description}
													price={`${startsFrom(restaurant, entry) ? "From " : ""}${money(entry.price)}`}
													badges={<DishBadges entry={entry} />}
													media={<DishArt dish={entry.dish} />}
													mediaBackground={restaurant.tones[0]}
													unavailable={closed}
												/>
											</li>
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
						<DishDialog restaurant={restaurant} entry={entry} visitor={visitor} back={back} />
					)),
				)}
			</>
		);
	};
}
