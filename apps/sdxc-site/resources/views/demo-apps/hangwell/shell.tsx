/**
 * Hangwell's frame around every screen: a sticky header with the shop menu (a native popover
 * mega menu on wide screens, a drawer on phones), search with suggestions, the account, the
 * wishlist and the bag drawer; the footer with help links and the demo reset; and a loading
 * line while the main frame swaps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ArrowRightIcon,
	ChevronDownIcon,
	HeartIcon,
	MenuIcon,
	RotateCcwIcon,
	SearchIcon,
	UserIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Amount, HeadingScope } from "@sdxc/ui";
import { Autocomplete } from "@sdxc/ui/autocomplete";
import { CartDrawer } from "@sdxc/ui/commerce/cart-drawer";
import { CartLine } from "@sdxc/ui/commerce/cart-line";
import { FulfilmentNote } from "@sdxc/ui/commerce/fulfilment-note";
import { QuantityStepper } from "@sdxc/ui/commerce/quantity-stepper";
import { Drawer } from "@sdxc/ui/drawer";
import { Meter } from "@sdxc/ui/meter";

import type { Visitor } from "./state";

import { FramedArt, PosterArt } from "./art";
import {
	ARTISTS,
	CURRENCY,
	FREE_SHIPPING_FROM,
	LOCALE,
	POSTERS,
	ROOMS,
	STYLES,
	actionHref,
	href,
	money,
	variantName,
} from "./data";
import { CONTENT_MAX, GUTTER, HEADER, WALL, WIDE } from "./parts";
import { isPhysical, lineCount, linePoster, lineTotal, priceCart } from "./state";

/** Which part of the shop a screen belongs to, for the header's current mark. */
export type Destination = "home" | "shop" | "artists" | "frames" | "account" | "bag" | "none";

/** The bag drawer's id. */
export const BAG_DRAWER = "hw-bag";

/** The shop mega menu's popover id. */
const SHOP_MENU = "hw-shop-menu";

/** The phone menu drawer's id. */
const PHONE_MENU = "hw-phone-menu";

/** The studio's mark: a nail and the string a frame hangs from, over a small frame. */
export function HangwellMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 28;
		return (
			<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
				<circle cx="16" cy="4" r="2.2" fill="var(--ui-color-brand-600)" />
				<path
					d="M16 5 L6 15 M16 5 L26 15"
					stroke="currentColor"
					stroke-width="1.6"
					fill="none"
					stroke-linecap="round"
				/>
				<rect
					x="5"
					y="14"
					width="22"
					height="16"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
				/>
				<rect x="9.5" y="18.5" width="13" height="7" fill="var(--ui-color-brand-600)" />
			</svg>
		);
	};
}

/** A quiet header control: an icon with an optional count. */
function headerButton() {
	return [
		raw({
			position: "relative",
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "2.75rem",
			blockSize: "2.75rem",
			padding: "0",
			border: "0",
			borderRadius: "999px",
			backgroundColor: "transparent",
			color: "inherit",
			cursor: "pointer",
			textDecoration: "none",
			"& svg": { inlineSize: "1.3rem", blockSize: "1.3rem" },
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-color-brand-600)", outlineOffset: "-2px" }),
		),
	];
}

/** A count bubble on a header icon. */
function CountBubble(handle: Handle<{ count: number }>) {
	return () =>
		handle.props.count === 0 ? null : (
			<span
				aria-hidden="true"
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "0.25rem",
						insetInlineEnd: "0.125rem",
						minInlineSize: "1.125rem",
						blockSize: "1.125rem",
						paddingInline: "0.25rem",
						boxSizing: "border-box",
						display: "grid",
						placeItems: "center",
						borderRadius: "999px",
						fontSize: "0.6875rem",
						fontWeight: "700",
						fontVariantNumeric: "tabular-nums",
						color: "white",
						backgroundColor: "var(--ui-color-brand-600)",
					}),
				]}
			>
				{handle.props.count}
			</span>
		);
}

/** A top-level link in the wide header's nav. */
function NavLink(
	handle: Handle<{ href: string; current: boolean; children: RemixNode; nav: string }>,
) {
	return () => (
		<a
			href={handle.props.href}
			data-main-nav={handle.props.nav}
			data-rmx-prefetch="intent"
			aria-current={handle.props.current ? "page" : undefined}
			mix={[navItem()]}
		>
			{handle.props.children}
		</a>
	);
}

/** The look a wide nav item shares, link or menu button. */
function navItem() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.25rem",
			blockSize: "2.5rem",
			paddingInline: "0.75rem",
			border: "0",
			borderRadius: "999px",
			background: "none",
			font: "inherit",
			fontWeight: "500",
			color: "inherit",
			textDecoration: "none",
			cursor: "pointer",
			"& svg": { inlineSize: "1rem", blockSize: "1rem" },
			"&[aria-current]": {
				textDecoration: "underline",
				textUnderlineOffset: "0.4em",
				textDecorationThickness: "2px",
			},
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-color-brand-600)", outlineOffset: "-2px" }),
		),
	];
}

/** A column heading inside the mega menu. */
function MenuColumn(handle: Handle<{ title: string; links: { href: string; label: string }[] }>) {
	return () => (
		<div mix={[raw({ display: "grid", alignContent: "start", gap: "0.5rem" })]}>
			<p
				mix={[
					raw({
						margin: "0 0 0.25rem",
						fontSize: "0.75rem",
						fontWeight: "600",
						letterSpacing: "0.12em",
						textTransform: "uppercase",
						color: "var(--ui-neutral-fg-muted)",
					}),
				]}
			>
				{handle.props.title}
			</p>
			{handle.props.links.map((link) => (
				<a
					href={link.href}
					data-rmx-prefetch="intent"
					mix={[
						raw({ color: "inherit", textDecoration: "none", paddingBlock: "0.125rem" }),
						when("&:hover", raw({ textDecoration: "underline", textUnderlineOffset: "0.25em" })),
					]}
				>
					{link.label}
				</a>
			))}
		</div>
	);
}

/** The links every menu lists: styles, rooms and artists. */
function menuLinks() {
	return {
		styles: [
			{ href: href("shop"), label: "All posters" },
			...STYLES.map((style) => ({ href: href(`shop/${style.id}`), label: style.name })),
		],
		rooms: ROOMS.map((room) => ({ href: href(`shop/${room.id}`), label: room.name })),
		artists: ARTISTS.slice(0, 6).map((artist) => ({
			href: href(`artists/${artist.id}`),
			label: artist.name,
		})),
	};
}

/**
 * The wide header's shop menu: a native popover under the header with the styles, rooms,
 * artists and a featured poster, opened by its button without script.
 */
function ShopMenu(handle: Handle<{ current: boolean }>) {
	return () => {
		let links = menuLinks();
		let featured = POSTERS.find((poster) => poster.id === "port-anselm")!;
		return (
			<>
				<button
					type="button"
					popovertarget={SHOP_MENU}
					aria-current={handle.props.current ? "page" : undefined}
					data-main-nav="shop"
					mix={[navItem()]}
				>
					Shop
					<ChevronDownIcon />
				</button>
				<div
					id={SHOP_MENU}
					popover="auto"
					mix={[
						raw({
							position: "fixed",
							inset: "auto",
							insetBlockStart: HEADER,
							insetInline: "0",
							margin: "0",
							padding: "0",
							border: "0",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							inlineSize: "100%",
							backgroundColor: "var(--ui-bg)",
							color: "var(--ui-neutral-fg)",
							boxShadow: "0 24px 48px -24px oklch(0.2 0.01 60 / 0.25)",
							opacity: "0",
							translate: "0 -0.5rem",
							transition:
								"opacity 160ms ease, translate 160ms ease, display 160ms allow-discrete, overlay 160ms allow-discrete",
							"&:popover-open": { opacity: "1", translate: "0 0" },
							"@starting-style": { "&:popover-open": { opacity: "0", translate: "0 -0.5rem" } },
						}),
						motionReduce(raw({ transition: "none" })),
					]}
				>
					<div
						mix={[
							raw({
								maxInlineSize: CONTENT_MAX,
								marginInline: "auto",
								padding: `2rem ${GUTTER} 2.5rem`,
								boxSizing: "border-box",
								display: "grid",
								gridTemplateColumns: "repeat(3, minmax(0, 1fr)) minmax(14rem, 18rem)",
								gap: "2rem",
							}),
						]}
					>
						<MenuColumn title="By style" links={links.styles} />
						<MenuColumn title="By room" links={links.rooms} />
						<MenuColumn
							title="Artists"
							links={[...links.artists, { href: href("artists"), label: "All artists" }]}
						/>
						<a
							href={href(`p/${featured.id}`)}
							mix={[
								raw({ display: "grid", gap: "0.5rem", color: "inherit", textDecoration: "none" }),
							]}
						>
							<span
								mix={[
									raw({
										display: "grid",
										placeItems: "center",
										padding: "1.25rem 2.5rem",
										backgroundColor: WALL,
									}),
								]}
							>
								<FramedArt poster={featured} frame="walnut" mount />
							</span>
							<span
								mix={[
									raw({
										fontSize: "0.75rem",
										fontWeight: "600",
										letterSpacing: "0.12em",
										textTransform: "uppercase",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								Poster of the month
							</span>
							<span mix={[raw({ fontWeight: "500" })]}>{featured.title}</span>
						</a>
					</div>
				</div>
			</>
		);
	};
}

/** Every poster, artist and collection, for the search field's suggestions. */
function searchOptions(): Autocomplete.Option[] {
	return [
		...STYLES.map((style) => ({ value: style.name, label: style.name, description: "Style" })),
		...ROOMS.map((room) => ({ value: room.name, label: room.name, description: "Room" })),
		...ARTISTS.map((artist) => ({
			value: artist.name,
			label: artist.name,
			description: `Artist · ${artist.city}`,
		})),
		...POSTERS.map((poster) => ({
			value: poster.title,
			label: poster.title,
			description: ARTISTS.find((artist) => artist.id === poster.artist)?.name ?? "",
		})),
	];
}

/** The search form: suggestions while typing, the results page on Enter. */
function SearchForm(handle: Handle<{ id: string; query?: string }>) {
	return () => (
		<form
			method="get"
			action={href("search")}
			role="search"
			mix={[
				raw({
					display: "flex",
					alignItems: "center",
					gap: "0.25rem",
					inlineSize: "100%",
					paddingInlineStart: "0.875rem",
					borderRadius: "999px",
					backgroundColor: "var(--ui-neutral-bg-tint)",
					"&:focus-within": { outline: "2px solid var(--ui-color-brand-600)" },
					"& svg": {
						inlineSize: "1.05rem",
						blockSize: "1.05rem",
						flex: "none",
						color: "var(--ui-neutral-fg-muted)",
					},
				}),
			]}
		>
			<SearchIcon />
			<Autocomplete
				id={handle.props.id}
				name="q"
				label="Search posters, artists and rooms"
				placeholder="Search posters"
				defaultValue={handle.props.query}
				options={searchOptions()}
				heading="Popular"
				emptyLabel="Press Enter to search everything"
				variant="bare"
				autocomplete="off"
				mix={[raw({ flex: "1", minInlineSize: "0" })]}
			/>
			<button type="submit" mix={[headerButton()]} aria-label="Search">
				<ArrowRightIcon />
			</button>
		</form>
	);
}

namespace BagLines {
	export interface Props {
		visitor: Visitor;
		back: string;
	}
}

/** The bag's lines with their steppers, for the drawer. */
function BagLines(handle: Handle<BagLines.Props>) {
	return () => {
		let { back, visitor } = handle.props;
		return (
			<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
				{visitor.lines.map((line, index) => {
					let poster = linePoster(line);
					return (
						<CartLine
							name={
								<a
									href={href(`p/${poster.id}`)}
									mix={[raw({ color: "inherit", textDecoration: "none" })]}
								>
									{poster.title}
								</a>
							}
							details={
								<span mix={[raw({ display: "grid", gap: "0.25rem" })]}>
									<span>{variantName(poster, line.variant)}</span>
									<FulfilmentNote kind={isPhysical(line) ? "ships" : "download"}>
										{isPhysical(line) ? "Ships in 3–5 days" : "Instant download"}
									</FulfilmentNote>
								</span>
							}
							price={<Amount value={lineTotal(line)} currency={CURRENCY} locale={LOCALE} />}
							media={
								line.variant.format === "framed" ? (
									<FramedArt
										poster={poster}
										frame={line.variant.frame}
										mount={line.variant.mount}
									/>
								) : (
									<PosterArt poster={poster} />
								)
							}
							mediaBackground={WALL}
							action={
								<QuantityStepper
									action={actionHref("cart/line")}
									value={line.qty}
									max={10}
									fields={{ line: String(index), back }}
									labels={{
										fewer: `One fewer ${poster.title}`,
										more: `One more ${poster.title}`,
										remove: `Remove ${poster.title}`,
										count: `${line.qty} of ${poster.title}`,
									}}
								/>
							}
						/>
					);
				})}
			</ul>
		);
	};
}

/** How far the bag is from free shipping, as a meter and a sentence. */
export function FreeShippingNote(handle: Handle<{ visitor: Visitor }>) {
	return () => {
		let { visitor } = handle.props;
		let totals = priceCart(visitor.lines, visitor.promo, visitor.draft.shipping);
		if (!visitor.lines.some(isPhysical)) {
			return (
				<p mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
					Everything here downloads. No shipping.
				</p>
			);
		}
		let reached = totals.toFreeShipping === 0;
		return (
			<div mix={[raw({ display: "grid", gap: "0.375rem", fontSize: "0.875rem" })]}>
				<span>
					{reached ? (
						"Standard shipping is free."
					) : (
						<>Add {money(totals.toFreeShipping)} more for free standard shipping.</>
					)}
				</span>
				<Meter>
					<Meter.Indicator
						value={Math.min(totals.physical, FREE_SHIPPING_FROM)}
						max={FREE_SHIPPING_FROM}
						aria-label="Progress to free shipping"
					/>
				</Meter>
			</div>
		);
	};
}

namespace HangwellShell {
	export interface Props {
		visitor: Visitor;
		current: Destination;
		/** The page the bag's steppers come back to. */
		back: string;
		query?: string;
		children: RemixNode;
	}
}

/** The header, the screen, the footer and the bag drawer. */
export default function HangwellShell(handle: Handle<HangwellShell.Props>) {
	return () => {
		let { back, children, current, query, visitor } = handle.props;
		let count = lineCount(visitor.lines);
		let totals = priceCart(visitor.lines, visitor.promo, visitor.draft.shipping);
		let links = menuLinks();
		return (
			<div
				mix={[
					raw({
						minBlockSize: "100dvh",
						display: "grid",
						gridTemplateRows: "auto 1fr auto",
						gridTemplateColumns: "minmax(0, 1fr)",
						backgroundColor: "var(--ui-bg)",
					}),
				]}
			>
				<a
					href="#hw-main"
					mix={[
						raw({
							position: "absolute",
							insetInlineStart: "-999px",
							"&:focus": {
								insetInlineStart: "1rem",
								insetBlockStart: "1rem",
								zIndex: "80",
								padding: "0.5rem 1rem",
								backgroundColor: "var(--ui-bg)",
							},
						}),
					]}
				>
					Skip to content
				</a>
				<header
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: "0",
							zIndex: "40",
							backgroundColor: "color-mix(in oklch, var(--ui-bg) 92%, transparent)",
							backdropFilter: "saturate(1.4) blur(12px)",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<div
						mix={[
							raw({
								maxInlineSize: CONTENT_MAX,
								marginInline: "auto",
								paddingInline: `calc(${GUTTER} - 0.5rem)`,
								blockSize: HEADER,
								boxSizing: "border-box",
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
								alignItems: "center",
								gap: "0.5rem",
								[`@media ${WIDE}`]: { gridTemplateColumns: "auto 1fr minmax(14rem, 22rem) auto" },
							}),
						]}
					>
						<div
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									[`@media ${WIDE}`]: { display: "none" },
								}),
							]}
						>
							<button
								type="button"
								command="show-modal"
								commandfor={PHONE_MENU}
								aria-label="Menu"
								mix={[headerButton()]}
							>
								<MenuIcon />
							</button>
							<a href={href("search")} aria-label="Search" mix={[headerButton()]}>
								<SearchIcon />
							</a>
						</div>
						<a
							href={href()}
							data-main-nav="home"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									justifySelf: "center",
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "none",
									fontWeight: "600",
									fontSize: "1.25rem",
									letterSpacing: "-0.02em",
									[`@media ${WIDE}`]: { justifySelf: "start", paddingInline: "0.5rem" },
								}),
							]}
						>
							<HangwellMark />
							<span>Hangwell</span>
						</a>
						<nav
							aria-label="Shop"
							mix={[
								raw({
									display: "none",
									[`@media ${WIDE}`]: { display: "flex", alignItems: "center", gap: "0.125rem" },
								}),
							]}
						>
							<ShopMenu current={current === "shop"} />
							<NavLink href={href("shop?sort=newest")} current={false} nav="new">
								New in
							</NavLink>
							<NavLink href={href("artists")} current={current === "artists"} nav="artists">
								Artists
							</NavLink>
							<NavLink href={href("frames")} current={current === "frames"} nav="frames">
								Frames &amp; sizes
							</NavLink>
							<NavLink href={href("shop?sale=1")} current={false} nav="sale">
								Sale
							</NavLink>
						</nav>
						<div mix={[raw({ display: "none", [`@media ${WIDE}`]: { display: "block" } })]}>
							<SearchForm id="hw-search" query={query} />
						</div>
						<div
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									justifyContent: "end",
									gap: "0.125rem",
								}),
							]}
						>
							<a
								href={href("account")}
								aria-label="Account"
								data-main-nav="account"
								aria-current={current === "account" ? "page" : undefined}
								mix={[
									headerButton(),
									raw({ display: "none", [`@media ${WIDE}`]: { display: "inline-grid" } }),
								]}
							>
								<UserIcon />
							</a>
							<a
								href={href("account/wishlist")}
								aria-label={`Wishlist, ${visitor.wish.length} saved`}
								mix={[headerButton()]}
							>
								<HeartIcon />
								<CountBubble count={visitor.wish.length} />
							</a>
							<CartDrawer.Trigger
								drawer={BAG_DRAWER}
								href={href("cart")}
								count={count}
								label="Bag"
							/>
						</div>
					</div>
				</header>
				<main id="hw-main" tabIndex={-1} mix={[raw({ outline: "none", minInlineSize: "0" })]}>
					{children}
				</main>
				<Footer />
				<HeadingScope level={2}>
					<CartDrawer
						id={BAG_DRAWER}
						title={count === 0 ? "Your bag" : `Your bag (${count})`}
						empty={
							<div mix={[raw({ display: "grid", gap: "0.75rem", justifyItems: "start" })]}>
								<p mix={[raw({ margin: "0" })]}>Your bag is empty.</p>
								<a href={href("shop")} mix={[raw({ color: "inherit", fontWeight: "500" })]}>
									Browse posters
								</a>
							</div>
						}
						subtotal={
							<>
								<span>Subtotal</span>
								<Amount value={totals.subtotal} currency={CURRENCY} locale={LOCALE} />
							</>
						}
						note={count === 0 ? undefined : <FreeShippingNote visitor={visitor} />}
						checkoutHref={href("checkout")}
						cartHref={href("cart")}
						labels={{ checkout: "Check out", viewCart: "View bag", close: "Close bag" }}
					>
						{count === 0 ? null : <BagLines visitor={visitor} back={back} />}
					</CartDrawer>
				</HeadingScope>
				<HeadingScope level={2}>
					<Drawer id={PHONE_MENU} placement="left" aria-labelledby={`${PHONE_MENU}-title`}>
						<Drawer.Header>
							<Drawer.Title id={`${PHONE_MENU}-title`}>Menu</Drawer.Title>
							<Drawer.Close commandfor={PHONE_MENU} aria-label="Close menu" />
						</Drawer.Header>
						<div
							mix={[
								raw({
									display: "grid",
									gap: "1.25rem",
									padding: "0 1.25rem 2rem",
									overflowY: "auto",
								}),
							]}
						>
							<SearchForm id="hw-search-phone" query={query} />
							<PhoneGroup title="Shop by style" links={links.styles} open />
							<PhoneGroup title="Shop by room" links={links.rooms} />
							<PhoneGroup
								title="Artists"
								links={[...links.artists, { href: href("artists"), label: "All artists" }]}
							/>
							<nav
								aria-label="More"
								mix={[raw({ display: "grid", gap: "0.25rem", fontSize: "1.125rem" })]}
							>
								{[
									{ href: href("shop?sort=newest"), label: "New in" },
									{ href: href("shop?sale=1"), label: "Sale" },
									{ href: href("frames"), label: "Frames & sizes" },
									{ href: href("account"), label: "Account" },
									{ href: href("account/orders"), label: "Orders" },
									{ href: href("track"), label: "Track an order" },
								].map((link) => (
									<a
										href={link.href}
										mix={[
											raw({ color: "inherit", textDecoration: "none", paddingBlock: "0.5rem" }),
										]}
									>
										{link.label}
									</a>
								))}
							</nav>
						</div>
					</Drawer>
				</HeadingScope>
			</div>
		);
	};
}

/** One disclosure of links in the phone menu. */
function PhoneGroup(
	handle: Handle<{ title: string; links: { href: string; label: string }[]; open?: boolean }>,
) {
	return () => (
		<details
			open={handle.props.open}
			mix={[
				raw({
					borderBlockEnd: "1px solid var(--ui-neutral-border)",
					paddingBlockEnd: "0.75rem",
					"& > summary": {
						listStyle: "none",
						cursor: "pointer",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						fontSize: "1.125rem",
						fontWeight: "500",
						paddingBlock: "0.5rem",
					},
					"& > summary::-webkit-details-marker": { display: "none" },
					"&[open] > summary svg": { rotate: "180deg" },
					"& > summary svg": {
						inlineSize: "1.125rem",
						blockSize: "1.125rem",
						transition: "rotate 150ms",
					},
				}),
			]}
		>
			<summary>
				{handle.props.title}
				<ChevronDownIcon />
			</summary>
			<div mix={[raw({ display: "grid", gap: "0.125rem", paddingInlineStart: "0.25rem" })]}>
				{handle.props.links.map((link) => (
					<a
						href={link.href}
						data-rmx-prefetch="intent"
						mix={[
							raw({
								color: "var(--ui-neutral-fg-muted)",
								textDecoration: "none",
								paddingBlock: "0.5rem",
							}),
						]}
					>
						{link.label}
					</a>
				))}
			</div>
		</details>
	);
}

/** The footer: help links, a newsletter form and the demo reset. */
function Footer() {
	return () => (
		<footer
			mix={[
				raw({
					marginBlockStart: "clamp(3rem, 8vw, 6rem)",
					borderBlockStart: "1px solid var(--ui-neutral-border)",
					backgroundColor: "var(--ui-neutral-bg-tint)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						maxInlineSize: CONTENT_MAX,
						marginInline: "auto",
						padding: `clamp(2rem, 5vw, 3.5rem) ${GUTTER}`,
						boxSizing: "border-box",
						display: "grid",
						gap: "2rem",
						gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.75rem",
							alignContent: "start",
							gridColumn: "1 / -1",
							"@media (min-width: 56rem)": { gridColumn: "auto / span 2" },
						}),
					]}
				>
					<span
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								gap: "0.5rem",
								fontWeight: "600",
								fontSize: "1.125rem",
							}),
						]}
					>
						<HangwellMark size={24} /> Hangwell
					</span>
					<p
						mix={[
							raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", maxInlineSize: "28rem" }),
						]}
					>
						An invented poster studio in Porto. Eight artists, printed to order on acid-free paper,
						framed by hand.
					</p>
					<form
						method="post"
						action={actionHref("newsletter")}
						mix={[raw({ display: "flex", gap: "0.5rem", maxInlineSize: "24rem" })]}
					>
						<label
							htmlFor="hw-newsletter"
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
							Email for new releases
						</label>
						<input
							id="hw-newsletter"
							type="email"
							name="email"
							required
							placeholder="you@example.com"
							autocomplete="email"
							mix={[
								raw({
									flex: "1",
									minInlineSize: "0",
									blockSize: "2.75rem",
									paddingInline: "0.875rem",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-cta-radius)",
									font: "inherit",
									backgroundColor: "var(--ui-bg)",
									color: "inherit",
								}),
							]}
						/>
						<button
							type="submit"
							mix={[
								raw({
									blockSize: "2.75rem",
									paddingInline: "1rem",
									border: "0",
									borderRadius: "var(--ui-cta-radius)",
									font: "inherit",
									fontWeight: "500",
									color: "var(--ui-bg)",
									backgroundColor: "var(--ui-neutral-fg-emphasis)",
									cursor: "pointer",
								}),
							]}
						>
							Subscribe
						</button>
					</form>
				</div>
				<FooterColumn
					title="Shop"
					links={[
						{ href: href("shop"), label: "All posters" },
						{ href: href("shop?sort=newest"), label: "New in" },
						{ href: href("artists"), label: "Artists" },
						{ href: href("shop?sale=1"), label: "Sale" },
					]}
				/>
				<FooterColumn
					title="Help"
					links={[
						{ href: href("frames"), label: "Frames & sizes" },
						{ href: href("track"), label: "Track an order" },
						{ href: href("account/orders"), label: "Returns" },
						{ href: href("help/shipping"), label: "Shipping" },
					]}
				/>
				<div mix={[raw({ display: "grid", gap: "0.5rem", alignContent: "start" })]}>
					<p mix={[raw({ margin: "0", fontWeight: "600" })]}>This is a demo</p>
					<p
						mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						Nothing is for sale, nothing is charged and nothing ships.
					</p>
					<form method="post" action={actionHref("reset")} data-main-scroll-top="">
						<button
							type="submit"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									padding: "0",
									border: "0",
									background: "none",
									font: "inherit",
									fontSize: "0.875rem",
									color: "inherit",
									textDecoration: "underline",
									cursor: "pointer",
									"& svg": { inlineSize: "0.875rem", blockSize: "0.875rem" },
								}),
							]}
						>
							<RotateCcwIcon /> Reset the demo
						</button>
					</form>
				</div>
			</div>
		</footer>
	);
}

/** A footer column of links. */
function FooterColumn(handle: Handle<{ title: string; links: { href: string; label: string }[] }>) {
	return () => (
		<nav
			aria-label={handle.props.title}
			mix={[raw({ display: "grid", gap: "0.5rem", alignContent: "start" })]}
		>
			<p mix={[raw({ margin: "0", fontWeight: "600" })]}>{handle.props.title}</p>
			{handle.props.links.map((link) => (
				<a
					href={link.href}
					data-rmx-prefetch="intent"
					mix={[
						raw({ color: "var(--ui-neutral-fg-muted)", textDecoration: "none" }),
						when("&:hover", raw({ color: "inherit", textDecoration: "underline" })),
					]}
				>
					{link.label}
				</a>
			))}
		</nav>
	);
}

/** A thin line across the top while the main frame loads the next screen. */
export function LoadingBar() {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					position: "fixed",
					insetBlockStart: "0",
					insetInline: "0",
					zIndex: "90",
					blockSize: "2px",
					transformOrigin: "0 50%",
					backgroundColor: "var(--ui-color-brand-600)",
					opacity: "0",
					scale: "0 1",
					pointerEvents: "none",
					"@keyframes hw-loading": {
						"0%": { opacity: "0", scale: "0 1" },
						"10%": { opacity: "1", scale: "0.15 1" },
						"100%": { opacity: "1", scale: "0.9 1" },
					},
					":root[data-main-loading] &": {
						animation: "hw-loading 8s cubic-bezier(0.1, 0.6, 0.2, 1) 150ms both",
					},
				}),
				motionReduce(
					raw({ ":root[data-main-loading] &": { animation: "none", opacity: "1", scale: "1 1" } }),
				),
			]}
		/>
	);
}
