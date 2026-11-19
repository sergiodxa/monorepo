/**
 * Bocado's chrome: a top bar with the mark, the delivery address picker, search, Orders and
 * the cart, each picker a native popover; on a phone, destinations move to a tab bar and a
 * "View cart" bar floats above it while the cart holds anything. It renders inside `main`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CheckIcon,
	ChevronDownIcon,
	HouseIcon,
	MapPinIcon,
	ReceiptIcon,
	RotateCcwIcon,
	SearchIcon,
	ShoppingBagIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { TAB_BAR_BLOCK_SIZE, TabBar } from "@sdxc/ui/app/tab-bar";

import routes from "~/routes/web";

import type { Visitor } from "./state";

import { ADDRESSES, actionHref, href, money } from "./data";
import { CONTENT_MAX, CartPanel, GUTTER, TOP_BAR, WIDE } from "./parts";
import { lineCount, lineTotal } from "./state";

/** Which destination a screen belongs to. */
export type Destination = "home" | "search" | "orders" | "cart" | "none";

/** The address picker's popover id. */
const ADDRESS_MENU = "bocado-address";

/** The cart popover's id. */
const CART_PANEL = "bocado-cart";

/**
 * Bocado's mark: a round bite taken out of a berry-coloured disc, with a leaf.
 *
 * @param handle Carries the mark's size in pixels.
 */
export function BocadoMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 30;
		return (
			<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
				<path
					d="M16 3a13 13 0 1 0 12.9 11.4 4.2 4.2 0 0 1-5-4.3 4.2 4.2 0 0 1-4.6-5.6A13 13 0 0 0 16 3Z"
					fill="var(--ui-color-brand-600)"
				/>
				<path
					d="M15.5 9.5c.3-2.6 2.2-4.4 4.8-4.6-.3 2.6-2.2 4.4-4.8 4.6Z"
					fill="oklch(0.72 0.17 140)"
				/>
				<circle cx="11.5" cy="17" r="1.6" fill="var(--ui-color-brand-100)" />
				<circle cx="16.5" cy="21.5" r="1.6" fill="var(--ui-color-brand-100)" />
				<circle cx="10.5" cy="23" r="1.2" fill="var(--ui-color-brand-100)" />
			</svg>
		);
	};
}

/** The surface a top-bar popover opens on, under the bar. */
function dropPanel(align: "start" | "end") {
	return raw({
		position: "fixed",
		inset: "auto",
		insetBlockStart: `calc(${TOP_BAR} - 0.25rem)`,
		...(align === "start"
			? { insetInlineStart: `max(${GUTTER}, calc((100vw - ${CONTENT_MAX}) / 2 + ${GUTTER}))` }
			: { insetInlineEnd: `max(${GUTTER}, calc((100vw - ${CONTENT_MAX}) / 2 + ${GUTTER}))` }),
		margin: "0",
		maxBlockSize: `calc(100dvh - ${TOP_BAR} - 1rem)`,
		overflow: "auto",
		padding: "0.75rem",
		boxSizing: "border-box",
		border: "0",
		borderRadius: "1rem",
		color: "var(--ui-neutral-fg)",
		backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
		boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 24px 48px -16px rgb(30 10 20 / 0.28)",
	});
}

/** The address button and its popover of saved addresses, each a post that delivers there. */
function AddressPicker(handle: Handle<{ visitor: Visitor; back: string }>) {
	return () => {
		let { back, visitor } = handle.props;
		return (
			<>
				<button
					type="button"
					popovertarget={ADDRESS_MENU}
					data-address-button=""
					aria-label={`Deliver to ${visitor.address.label}, ${visitor.address.line}. Change address`}
					mix={[
						raw({
							display: "inline-grid",
							gridTemplateColumns: "auto minmax(0, 1fr) auto",
							alignItems: "center",
							columnGap: "0.5rem",
							minInlineSize: "0",
							maxInlineSize: "20rem",
							blockSize: "2.75rem",
							paddingInline: "0.625rem 0.5rem",
							border: "0",
							borderRadius: "999px",
							font: "inherit",
							textAlign: "start",
							color: "var(--ui-neutral-fg-emphasis)",
							backgroundColor: "var(--ui-neutral-bg-subtle)",
							cursor: "pointer",
						}),
						when(
							"&:hover",
							raw({ backgroundColor: "var(--ui-neutral-bg-muted, var(--ui-neutral-bg-subtle))" }),
						),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
						),
					]}
				>
					<MapPinIcon aria-hidden="true" size={18} mix={[raw({ color: "var(--ui-brand-fg)" })]} />
					<span
						aria-hidden="true"
						mix={[raw({ display: "grid", minInlineSize: "0", lineHeight: "1.15" })]}
					>
						<span
							mix={[
								raw({
									fontSize: "0.6875rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Deliver to {visitor.address.label}
						</span>
						<span
							mix={[
								raw({
									fontSize: "0.875rem",
									fontWeight: "700",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}),
							]}
						>
							{visitor.address.line}
						</span>
					</span>
					<ChevronDownIcon aria-hidden="true" size={16} />
				</button>
				<div
					id={ADDRESS_MENU}
					popover="auto"
					aria-label="Delivery address"
					mix={[dropPanel("start"), raw({ inlineSize: "min(22rem, calc(100vw - 2rem))" })]}
				>
					<p
						mix={[
							raw({
								margin: "0.25rem 0.5rem 0.5rem",
								fontSize: "0.8125rem",
								fontWeight: "700",
								textTransform: "uppercase",
								letterSpacing: "0.06em",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						Deliver to
					</p>
					<ul
						mix={[
							raw({
								display: "grid",
								gap: "0.125rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
						]}
					>
						{ADDRESSES.map((address) => {
							let on = address.id === visitor.address.id;
							return (
								<li>
									<form method="post" action={actionHref("address")}>
										<input type="hidden" name="address" value={address.id} />
										<input type="hidden" name="back" value={back} />
										<button
											type="submit"
											aria-current={on ? "true" : undefined}
											mix={[
												raw({
													display: "grid",
													gridTemplateColumns: "2.25rem minmax(0, 1fr) 1.25rem",
													alignItems: "center",
													gap: "0.75rem",
													inlineSize: "100%",
													padding: "0.625rem 0.5rem",
													border: "0",
													borderRadius: "0.75rem",
													font: "inherit",
													textAlign: "start",
													color: "inherit",
													background: "transparent",
													cursor: "pointer",
												}),
												when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
												when(
													"&:focus-visible",
													raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
												),
											]}
										>
											<span
												aria-hidden="true"
												mix={[
													raw({
														display: "grid",
														placeItems: "center",
														inlineSize: "2.25rem",
														blockSize: "2.25rem",
														borderRadius: "999px",
														color: on
															? "var(--ui-brand-fg-on-solid, white)"
															: "var(--ui-neutral-fg)",
														backgroundColor: on
															? "var(--ui-brand-bg-solid)"
															: "var(--ui-neutral-bg-subtle)",
													}),
												]}
											>
												<MapPinIcon size={16} />
											</span>
											<span mix={[raw({ display: "grid", gap: "0.0625rem" })]}>
												<span
													mix={[raw({ fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" })]}
												>
													{address.label}
												</span>
												<span mix={[raw({ fontSize: "0.875rem" })]}>{address.line}</span>
												<span
													mix={[
														raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
													]}
												>
													{address.note}
												</span>
											</span>
											{on ? (
												<CheckIcon
													aria-hidden="true"
													size={18}
													mix={[raw({ color: "var(--ui-brand-fg)" })]}
												/>
											) : (
												<span />
											)}
										</button>
									</form>
								</li>
							);
						})}
					</ul>
				</div>
			</>
		);
	};
}

/** The wide bar's search box: a plain GET form to the search screen. */
function SearchBox() {
	return () => (
		<form
			method="get"
			action={href("search")}
			role="search"
			mix={[
				raw({
					display: "none",
					position: "relative",
					flex: "1 1 auto",
					maxInlineSize: "26rem",
					[`@media ${WIDE}`]: { display: "block" },
				}),
			]}
		>
			<SearchIcon
				aria-hidden="true"
				size={17}
				mix={[
					raw({
						position: "absolute",
						insetInlineStart: "0.875rem",
						insetBlockStart: "50%",
						translate: "0 -50%",
						color: "var(--ui-neutral-fg-muted)",
						pointerEvents: "none",
					}),
				]}
			/>
			<input
				type="search"
				name="q"
				aria-label="Search restaurants and dishes"
				placeholder="Search restaurants and dishes"
				autocomplete="off"
				mix={[
					raw({
						inlineSize: "100%",
						blockSize: "2.75rem",
						paddingInline: "2.5rem 1rem",
						boxSizing: "border-box",
						border: "0",
						borderRadius: "999px",
						font: "inherit",
						fontSize: "0.9375rem",
						color: "var(--ui-neutral-fg-emphasis)",
						backgroundColor: "var(--ui-neutral-bg-subtle)",
						"&::placeholder": { color: "var(--ui-neutral-fg-muted)" },
					}),
					when(
						"&:focus",
						raw({ outline: "none", boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" }),
					),
				]}
			/>
		</form>
	);
}

/** The look of the bar's plain links and buttons. */
function barButton() {
	return [
		raw({
			position: "relative",
			display: "inline-flex",
			alignItems: "center",
			gap: "0.5rem",
			blockSize: "2.75rem",
			paddingInline: "0.875rem",
			border: "0",
			borderRadius: "999px",
			font: "inherit",
			fontSize: "0.9375rem",
			fontWeight: "650",
			color: "var(--ui-neutral-fg-emphasis)",
			background: "transparent",
			textDecoration: "none",
			cursor: "pointer",
			whiteSpace: "nowrap",
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
		when("&[aria-current='page']", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
		),
	];
}

/**
 * The cart button and its popover. The button shows the count and the subtotal, filled in the
 * brand while the cart holds anything; the popover is the cart itself, steppers and all.
 */
function CartButton(handle: Handle<{ visitor: Visitor; back: string; current: boolean }>) {
	return () => {
		let { back, current, visitor } = handle.props;
		let cart = visitor.cart;
		let count = cart === undefined ? 0 : lineCount(cart.lines);
		let subtotal =
			cart === undefined
				? 0
				: cart.lines.reduce((sum, line) => sum + lineTotal(cart.restaurant, line), 0);
		return (
			<>
				<button
					type="button"
					popovertarget={CART_PANEL}
					data-cart-button={String(count)}
					aria-label={
						count === 0
							? "Cart, empty"
							: `Cart, ${count} ${count === 1 ? "item" : "items"}, ${money(subtotal)}`
					}
					aria-current={current ? "page" : undefined}
					mix={[
						barButton(),
						raw({ display: "none", [`@media ${WIDE}`]: { display: "inline-flex" } }),
						count === 0
							? raw({})
							: raw({
									color: "var(--ui-brand-fg-on-solid, white)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									"&:hover": {
										backgroundColor: "var(--ui-brand-bg-solid-hover, var(--ui-brand-bg-solid))",
									},
								}),
					]}
				>
					<ShoppingBagIcon aria-hidden="true" size={19} />
					<span aria-hidden="true" mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
						{count === 0 ? "Cart" : `${count} · ${money(subtotal)}`}
					</span>
				</button>
				<div
					id={CART_PANEL}
					popover="auto"
					aria-label="Your cart"
					mix={[
						dropPanel("end"),
						raw({ inlineSize: "min(25rem, calc(100vw - 2rem))", padding: "1rem" }),
					]}
				>
					<CartPanel cart={cart} back={back} compact />
				</div>
			</>
		);
	};
}

/** The top bar: mark, address, search, Orders and the cart. */
function TopBar(handle: Handle<{ current: Destination; visitor: Visitor; back: string }>) {
	return () => {
		let { back, current, visitor } = handle.props;
		return (
			<header
				data-bocado-bar=""
				mix={[
					raw({
						position: "sticky",
						insetBlockStart: "0",
						zIndex: "20",
						blockSize: TOP_BAR,
						backgroundColor: "color-mix(in oklch, var(--ui-bg) 90%, transparent)",
						backdropFilter: "blur(16px) saturate(1.4)",
						WebkitBackdropFilter: "blur(16px) saturate(1.4)",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "clamp(0.5rem, 1.5vw, 1.25rem)",
							blockSize: "100%",
							maxInlineSize: CONTENT_MAX,
							marginInline: "auto",
							paddingInline: GUTTER,
							boxSizing: "border-box",
						}),
					]}
				>
					<a
						href={href()}
						aria-label="Bocado home"
						data-main-scroll-top=""
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								gap: "0.375rem",
								flexShrink: "0",
								color: "var(--ui-neutral-fg-emphasis)",
								textDecoration: "none",
								fontSize: "1.375rem",
								fontWeight: "800",
								letterSpacing: "-0.03em",
							}),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "4px" }),
							),
						]}
					>
						<BocadoMark />
						<span
							aria-hidden="true"
							mix={[raw({ display: "none", "@media (min-width: 30rem)": { display: "inline" } })]}
						>
							bocado
						</span>
					</a>
					<AddressPicker visitor={visitor} back={back} />
					<SearchBox />
					<span mix={[raw({ flex: "1 1 0", [`@media ${WIDE}`]: { flex: "0 0 0" } })]} />
					<a
						href={href("orders")}
						data-main-nav="orders"
						aria-current={current === "orders" ? "page" : undefined}
						mix={[
							barButton(),
							raw({ display: "none", [`@media ${WIDE}`]: { display: "inline-flex" } }),
						]}
					>
						<ReceiptIcon aria-hidden="true" size={18} />
						Orders
					</a>
					<CartButton visitor={visitor} back={back} current={current === "cart"} />
				</div>
			</header>
		);
	};
}

/**
 * On a phone, a bar over the tab bar while the cart holds anything: its restaurant, count and
 * subtotal, leading to the cart.
 */
function FloatingCart(handle: Handle<{ visitor: Visitor }>) {
	return () => {
		let cart = handle.props.visitor.cart;
		if (cart === undefined) return null;
		let count = lineCount(cart.lines);
		let subtotal = cart.lines.reduce((sum, line) => sum + lineTotal(cart.restaurant, line), 0);
		return (
			<a
				href={href("cart")}
				data-floating-cart=""
				data-main-scroll-top=""
				mix={[
					raw({
						position: "fixed",
						insetInline: "0.75rem",
						insetBlockEnd: `calc(${TAB_BAR_BLOCK_SIZE} + env(safe-area-inset-bottom, 0px) + 0.625rem)`,
						zIndex: "30",
						display: "grid",
						gridTemplateColumns: "auto minmax(0, 1fr) auto",
						alignItems: "center",
						gap: "0.75rem",
						minBlockSize: "3.25rem",
						paddingInline: "0.875rem 1rem",
						borderRadius: "1rem",
						color: "var(--ui-brand-fg-on-solid, white)",
						backgroundColor: "var(--ui-brand-bg-solid)",
						boxShadow: "0 12px 32px -10px rgb(60 0 30 / 0.5)",
						textDecoration: "none",
						animation: "bocado-rise 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
						"@keyframes bocado-rise": {
							from: { translate: "0 1rem", opacity: "0" },
							to: { translate: "0 0", opacity: "1" },
						},
						[`@media ${WIDE}`]: { display: "none" },
					}),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
					motionReduce(raw({ animation: "none" })),
				]}
			>
				<span
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							minInlineSize: "1.75rem",
							blockSize: "1.75rem",
							borderRadius: "999px",
							fontWeight: "800",
							fontVariantNumeric: "tabular-nums",
							backgroundColor: "rgb(255 255 255 / 0.2)",
						}),
					]}
				>
					{count}
				</span>
				<span mix={[raw({ display: "grid", lineHeight: "1.2", minInlineSize: "0" })]}>
					<span mix={[raw({ fontWeight: "750" })]}>View cart</span>
					<span
						mix={[
							raw({
								fontSize: "0.8125rem",
								opacity: "0.85",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}),
						]}
					>
						{cart.restaurant.name}
					</span>
				</span>
				<span mix={[raw({ fontWeight: "750", fontVariantNumeric: "tabular-nums" })]}>
					{money(subtotal)}
				</span>
			</a>
		);
	};
}

namespace BocadoShell {
	export interface Props {
		visitor: Visitor;
		current: Destination;
		/** The screen's own page path and query, which the bar's posts return to. */
		back: string;
		children: RemixNode;
	}
}

/**
 * Renders a screen in Bocado's frame: the top bar, the content, the footer and the phone bars.
 * On a phone it lifts the page's toasts above the tab bar and the floating cart, so neither hides one.
 */
export default function BocadoShell(handle: Handle<BocadoShell.Props>) {
	return () => {
		let { back, children, current, visitor } = handle.props;
		let count = visitor.cart === undefined ? 0 : lineCount(visitor.cart.lines);
		return (
			<div
				data-bocado-shell=""
				mix={[
					raw({
						flex: "1 1 auto",
						display: "flex",
						flexDirection: "column",
						minBlockSize: "100dvh",
						backgroundColor: "var(--ui-bg)",
						[`@media not ${WIDE}`]: {
							":root:has(&) [data-slot='region'][data-placement^='bottom']": {
								paddingBlockEnd: `calc(${TAB_BAR_BLOCK_SIZE} + env(safe-area-inset-bottom, 0px) + 0.75rem)`,
							},
							":root:has(&):has([data-floating-cart]) [data-slot='region'][data-placement^='bottom']":
								{
									paddingBlockEnd: `calc(${TAB_BAR_BLOCK_SIZE} + env(safe-area-inset-bottom, 0px) + 4.5rem)`,
								},
						},
					}),
				]}
			>
				<a
					href="#bocado-main"
					mix={[
						raw({
							position: "absolute",
							insetBlockStart: "-4rem",
							insetInlineStart: "1rem",
							zIndex: "40",
							padding: "0.5rem 0.75rem",
							borderRadius: "0.5rem",
							backgroundColor: "var(--ui-neutral-bg-solid)",
							color: "var(--ui-neutral-fg-on-solid)",
						}),
						when("&:focus", raw({ insetBlockStart: "1rem" })),
					]}
				>
					Skip to content
				</a>
				<TopBar current={current} visitor={visitor} back={back} />
				<main
					id="bocado-main"
					mix={[raw({ flex: "1 1 auto", minInlineSize: "0", paddingBlockEnd: "3rem" })]}
				>
					{children}
				</main>
				<footer
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.75rem",
							inlineSize: "100%",
							maxInlineSize: CONTENT_MAX,
							marginInline: "auto",
							paddingInline: GUTTER,
							paddingBlock: "2rem",
							boxSizing: "border-box",
							borderBlockStart: "1px solid var(--ui-neutral-border)",
							fontSize: "0.8125rem",
							lineHeight: "1.5",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span>
						Bocado is an invented delivery app, a demo of{" "}
						<a href={routes.demos.href()} mix={[raw({ color: "inherit" })]}>
							sdxc.dev's components
						</a>
						. Every restaurant, dish and card in it is made up, and nothing is charged.
					</span>
					<form method="post" action={actionHref("reset")} data-main-scroll-top="">
						<button
							type="submit"
							mix={[
								barButton(),
								raw({ blockSize: "2.25rem", fontSize: "0.8125rem", color: "var(--ui-neutral-fg)" }),
							]}
						>
							<RotateCcwIcon aria-hidden="true" size={15} />
							Reset the demo
						</button>
					</form>
				</footer>
				{current === "cart" || current === "orders" ? null : <FloatingCart visitor={visitor} />}
				<TabBar label="Primary" hideFrom="48rem">
					<TabBar.Item
						href={href()}
						icon={<HouseIcon />}
						label="Home"
						current={current === "home"}
						data-main-nav="home"
						data-main-scroll-top=""
					/>
					<TabBar.Item
						href={href("search")}
						icon={<SearchIcon />}
						label="Search"
						current={current === "search"}
						data-main-nav="search"
						data-main-scroll-top=""
					/>
					<TabBar.Item
						href={href("orders")}
						icon={<ReceiptIcon />}
						label="Orders"
						current={current === "orders"}
						data-main-nav="orders"
						data-main-scroll-top=""
					/>
					<TabBar.Item
						href={href("cart")}
						icon={<ShoppingBagIcon />}
						label="Cart"
						current={current === "cart"}
						count={count}
						countLabel={`${count} in cart`}
						data-main-nav="cart"
						data-main-scroll-top=""
					/>
				</TabBar>
			</div>
		);
	};
}

/**
 * A thin brand-coloured bar across the top of the window while a screen or post loads in
 * `main`. It waits a beat before showing, so a fast swap never flashes it.
 */
export function LoadingBar() {
	return () => (
		<span
			aria-hidden="true"
			data-bocado-loading=""
			mix={[
				raw({
					position: "fixed",
					insetBlockStart: "0",
					insetInline: "0",
					zIndex: "60",
					blockSize: "3px",
					transformOrigin: "0 50%",
					backgroundColor: "var(--ui-color-brand-500)",
					opacity: "0",
					scale: "0 1",
					pointerEvents: "none",
					"@keyframes bocado-loading": {
						"0%": { opacity: "0", scale: "0 1" },
						"10%": { opacity: "1", scale: "0.15 1" },
						"100%": { opacity: "1", scale: "0.9 1" },
					},
					":root[data-main-loading] &": {
						animation: "bocado-loading 8s cubic-bezier(0.1, 0.6, 0.2, 1) 150ms both",
					},
				}),
				motionReduce(
					raw({ ":root[data-main-loading] &": { animation: "none", opacity: "1", scale: "1 1" } }),
				),
			]}
		/>
	);
}
