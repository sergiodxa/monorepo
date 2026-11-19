/**
 * The cart page and checkout. The cart lists every line with its stepper and the way on;
 * checkout picks the address, the speed, a saved invented payment method and the tip, and
 * prices it all beside the Place order button. Both are plain forms that post without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BanknoteIcon,
	BikeIcon,
	CreditCardIcon,
	LockIcon,
	MapPinIcon,
	WalletIcon,
	ZapIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { percentOf } from "@sdxc/money";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LinkButton } from "@sdxc/ui";

import type { PaymentMethod } from "./data";
import type { Cart, Totals, Visitor } from "./state";

import { DishArt } from "./art";
import { CheckoutLive } from "./checkout-live";
import {
	ADDRESSES,
	PAYMENT_METHODS,
	PRIORITY_FEE,
	TIPS,
	actionHref,
	etaLabel,
	findItem,
	href,
	money,
} from "./data";
import { CARD_RADIUS, CartPanel, Gutter } from "./parts";
import { choiceSummary, lineCount, lineTotal, priceLines } from "./state";

/** The tip checkout starts on. */
export const DEFAULT_TIP = 15;

/** A screen's title row. */
function ScreenTitle(handle: Handle<{ title: string; note?: string }>) {
	return () => (
		<div mix={[raw({ display: "grid", gap: "0.25rem", paddingBlock: "1.75rem 1.25rem" })]}>
			<h1
				mix={[
					raw({
						margin: "0",
						fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)",
						fontWeight: "800",
						letterSpacing: "-0.02em",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{handle.props.title}
			</h1>
			{handle.props.note === undefined ? null : (
				<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>{handle.props.note}</p>
			)}
		</div>
	);
}

/** Two columns from a laptop's width: the main column and a sticky summary beside it. */
function TwoColumns(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gap: "1.5rem",
					"@media (min-width: 60rem)": {
						gridTemplateColumns: "minmax(0, 1fr) 22rem",
						alignItems: "start",
						gap: "2.5rem",
					},
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

/** A bordered panel. */
function Panel(handle: Handle<{ children: RemixNode; sticky?: boolean; label?: string }>) {
	return () => (
		<div
			aria-label={handle.props.label}
			role={handle.props.label === undefined ? undefined : "region"}
			mix={[
				raw({
					padding: "1.25rem",
					borderRadius: CARD_RADIUS,
					boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
					backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
				}),
				handle.props.sticky === true
					? raw({ "@media (min-width: 60rem)": { position: "sticky", insetBlockStart: "5rem" } })
					: raw({}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

/** One row of a price summary; `total` sets it larger and bolder. */
function SumRow(
	handle: Handle<{
		label: RemixNode;
		value: number;
		total?: boolean;
		name?: string;
		hidden?: boolean;
	}>,
) {
	return () => {
		let { hidden, label, name, total = false, value } = handle.props;
		return (
			<div
				data-sum-row={name}
				hidden={hidden}
				mix={[
					raw({
						display: "flex",
						justifyContent: "space-between",
						gap: "1rem",
						paddingBlock: total ? "0.75rem 0" : "0.25rem",
						fontSize: total ? "1.125rem" : "0.9375rem",
						fontWeight: total ? "800" : "500",
						color: total ? "var(--ui-neutral-fg-emphasis)" : "var(--ui-neutral-fg)",
						borderBlockStart: total ? "1px solid var(--ui-neutral-border)" : "0",
						marginBlockStart: total ? "0.5rem" : "0",
						"&[hidden]": { display: "none" },
					}),
				]}
			>
				<span>{label}</span>
				<output data-sum={name} mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
					{value === 0 && name === "delivery" ? "Free" : money(value)}
				</output>
			</div>
		);
	};
}

/** Every line of a priced order. */
export function Summary(handle: Handle<{ totals: Totals; tip: number }>) {
	return () => {
		let { tip, totals } = handle.props;
		return (
			<div>
				<SumRow label="Subtotal" value={totals.subtotal} name="subtotal" />
				<SumRow label="Delivery" value={totals.delivery} name="delivery" />
				<SumRow label="Service fee" value={totals.service} name="service" />
				<SumRow
					label="Priority delivery"
					value={totals.priority}
					name="priority"
					hidden={totals.priority === 0}
				/>
				<SumRow
					label={
						<>
							Courier tip <span data-sum-tip-percent="">({tip}%)</span>
						</>
					}
					value={totals.tip}
					name="tip"
				/>
				<SumRow label="Total" value={totals.total} name="total" total />
			</div>
		);
	};
}

/** The cart page: the cart beside its summary and the way to checkout. */
export function CartPage(handle: Handle<{ visitor: Visitor }>) {
	return () => {
		let { cart } = handle.props.visitor;
		if (cart === undefined) {
			return (
				<Gutter>
					<ScreenTitle title="Your cart" />
					<Panel>
						<CartPanel cart={undefined} back="cart" />
						<div mix={[raw({ display: "flex", justifyContent: "center" })]}>
							<LinkButton href={href()} color="brand" data-main-scroll-top="">
								Find something to eat
							</LinkButton>
						</div>
					</Panel>
				</Gutter>
			);
		}
		let totals = priceLines(cart.restaurant, cart.lines, { tip: 0, priority: false });
		return (
			<Gutter>
				<ScreenTitle
					title="Your cart"
					note={`From ${cart.restaurant.name} · ${etaLabel(cart.restaurant)} to your door`}
				/>
				<TwoColumns>
					<Panel>
						<CartPanel cart={cart} back="cart" compact={false} />
						<div
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									justifyContent: "space-between",
									gap: "0.75rem",
									marginBlockStart: "0.5rem",
								}),
							]}
						>
							<LinkButton
								href={href(`r/${cart.restaurant.id}`)}
								variant="outline"
								data-main-scroll-top=""
							>
								Add more from {cart.restaurant.name}
							</LinkButton>
							<form method="post" action={actionHref("cart/clear")}>
								<input type="hidden" name="back" value="cart" />
								<button
									type="submit"
									mix={[
										raw({
											blockSize: "2.5rem",
											paddingInline: "1rem",
											border: "0",
											borderRadius: "999px",
											font: "inherit",
											fontWeight: "650",
											color: "var(--ui-danger-fg, var(--ui-neutral-fg))",
											background: "transparent",
											cursor: "pointer",
										}),
										when(
											"&:hover",
											raw({
												backgroundColor: "var(--ui-danger-bg-subtle, var(--ui-neutral-bg-subtle))",
											}),
										),
										when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring)" })),
									]}
								>
									Empty cart
								</button>
							</form>
						</div>
					</Panel>
					<Panel sticky label="Order summary">
						<SumRow label="Subtotal" value={totals.subtotal} />
						<SumRow label="Delivery" value={totals.delivery} name="delivery" />
						<SumRow label="Service fee" value={totals.service} />
						<p
							mix={[
								raw({
									margin: "0.5rem 0 1rem",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Tip and delivery speed are picked at checkout.
						</p>
						<LinkButton
							href={href("checkout")}
							color="brand"
							size="lg"
							data-main-scroll-top=""
							mix={[raw({ inlineSize: "100%" })]}
						>
							Go to checkout
						</LinkButton>
					</Panel>
				</TwoColumns>
			</Gutter>
		);
	};
}

/** The look of a selectable card wrapping a radio. */
function radioCard() {
	return [
		raw({
			display: "grid",
			gridTemplateColumns: "auto minmax(0, 1fr) auto",
			alignItems: "center",
			gap: "0.875rem",
			padding: "0.875rem 1rem",
			borderRadius: "0.875rem",
			boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
			cursor: "pointer",
			"& input": {
				margin: "0",
				inlineSize: "1.125rem",
				blockSize: "1.125rem",
				accentColor: "var(--ui-color-brand-600)",
			},
			"&:has(input:checked)": {
				boxShadow: "inset 0 0 0 2px var(--ui-color-brand-600)",
				backgroundColor: "var(--ui-brand-bg-subtle)",
			},
			"&:has(input:focus-visible)": {
				outline: "2px solid var(--ui-brand-ring)",
				outlineOffset: "2px",
			},
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
	];
}

/** A checkout step: a numbered heading over its choices. */
function Step(handle: Handle<{ n: number; title: string; children: RemixNode }>) {
	return () => (
		<fieldset
			mix={[raw({ margin: "0", padding: "0", border: "0", display: "grid", gap: "0.625rem" })]}
		>
			<legend
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.625rem",
						padding: "0",
						marginBlockEnd: "0.75rem",
						fontSize: "1.125rem",
						fontWeight: "800",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				<span
					aria-hidden="true"
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							inlineSize: "1.75rem",
							blockSize: "1.75rem",
							borderRadius: "999px",
							fontSize: "0.875rem",
							color: "var(--ui-neutral-fg-on-solid)",
							backgroundColor: "var(--ui-neutral-bg-solid)",
						}),
					]}
				>
					{handle.props.n}
				</span>
				{handle.props.title}
			</legend>
			{handle.props.children}
		</fieldset>
	);
}

/** The icon each kind of payment method is drawn with. */
const PAYMENT_ICONS = { card: CreditCardIcon, wallet: WalletIcon, cash: BanknoteIcon } as const;

/** The icon a payment method is drawn with. */
function PaymentIcon(handle: Handle<{ method: PaymentMethod }>) {
	return () => {
		let { kind } = handle.props.method;
		let Icon = PAYMENT_ICONS[kind];
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "grid",
						placeItems: "center",
						inlineSize: "2.75rem",
						blockSize: "2rem",
						borderRadius: "0.375rem",
						color: kind === "card" ? "white" : "var(--ui-neutral-fg-emphasis)",
						background: iife(() => {
							if (kind !== "card") return "var(--ui-neutral-bg-subtle)";
							return handle.props.method.id === "work"
								? "linear-gradient(135deg, oklch(0.42 0.06 250), oklch(0.3 0.05 260))"
								: "linear-gradient(135deg, var(--ui-color-brand-500), var(--ui-color-brand-800))";
						}),
					}),
				]}
			>
				<Icon size={17} />
			</span>
		);
	};
}

/** A small list of what is being ordered, for the summary. */
function OrderItems(handle: Handle<{ cart: Cart }>) {
	return () => {
		let { cart } = handle.props;
		return (
			<ul
				mix={[
					raw({
						display: "grid",
						gap: "0.625rem",
						margin: "0 0 1rem",
						padding: "0 0 1rem",
						listStyle: "none",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				{cart.lines.map((line) => {
					let entry = findItem(cart.restaurant, line.item);
					if (entry === undefined) return null;
					let picks = choiceSummary(cart.restaurant, line);
					return (
						<li
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "2.25rem minmax(0, 1fr) auto",
									gap: "0.625rem",
									alignItems: "center",
									fontSize: "0.875rem",
								}),
							]}
						>
							<span
								mix={[
									raw({
										inlineSize: "2.25rem",
										blockSize: "2.25rem",
										padding: "0.125rem",
										boxSizing: "border-box",
										borderRadius: "0.5rem",
										backgroundColor: cart.restaurant.tones[0],
									}),
								]}
							>
								<DishArt dish={entry.dish} />
							</span>
							<span mix={[raw({ display: "grid", minInlineSize: "0" })]}>
								<span mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}>
									{line.qty} × {entry.name}
								</span>
								{picks === "" ? null : (
									<span
										mix={[
											raw({
												fontSize: "0.75rem",
												color: "var(--ui-neutral-fg-muted)",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}),
										]}
									>
										{picks}
									</span>
								)}
							</span>
							<span mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
								{money(lineTotal(cart.restaurant, line))}
							</span>
						</li>
					);
				})}
			</ul>
		);
	};
}

namespace CheckoutPage {
	export interface Props {
		visitor: Visitor;
	}
}

/**
 * Renders checkout: the address, speed, payment and tip as radio cards inside one form, and
 * the summary with Place order. An empty cart leads back to the restaurants instead.
 */
export function CheckoutPage(handle: Handle<CheckoutPage.Props>) {
	return () => {
		let { visitor } = handle.props;
		let cart = visitor.cart;
		if (cart === undefined) {
			return (
				<Gutter>
					<ScreenTitle title="Checkout" />
					<Panel>
						<CartPanel cart={undefined} back="checkout" />
						<div mix={[raw({ display: "flex", justifyContent: "center" })]}>
							<LinkButton href={href()} color="brand" data-main-scroll-top="">
								Find something to eat
							</LinkButton>
						</div>
					</Panel>
				</Gutter>
			);
		}
		let totals = priceLines(cart.restaurant, cart.lines, { tip: DEFAULT_TIP, priority: false });
		let count = lineCount(cart.lines);
		return (
			<Gutter>
				<ScreenTitle
					title="Checkout"
					note={`${count} ${count === 1 ? "item" : "items"} from ${cart.restaurant.name}`}
				/>
				<form
					method="post"
					action={actionHref("checkout")}
					id="bocado-checkout"
					data-checkout=""
					data-subtotal={String(totals.subtotal)}
					data-delivery={String(totals.delivery)}
					data-service={String(totals.service)}
					data-priority-fee={String(PRIORITY_FEE)}
					data-main-scroll-top=""
				>
					<TwoColumns>
						<div mix={[raw({ display: "grid", gap: "2rem" })]}>
							<Step n={1} title="Deliver to">
								{ADDRESSES.map((address) => (
									<label mix={radioCard()}>
										<input
											type="radio"
											name="address"
											value={address.id}
											checked={address.id === visitor.address.id}
											required
										/>
										<span mix={[raw({ display: "grid", gap: "0.125rem" })]}>
											<span
												mix={[raw({ fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" })]}
											>
												{address.label}
											</span>
											<span mix={[raw({ fontSize: "0.875rem" })]}>{address.line}</span>
											<span
												mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
											>
												{address.note}
											</span>
										</span>
										<MapPinIcon
											aria-hidden="true"
											size={18}
											mix={[raw({ color: "var(--ui-neutral-fg-subtle)" })]}
										/>
									</label>
								))}
							</Step>
							<Step n={2} title="Delivery speed">
								<label mix={radioCard()}>
									<input type="radio" name="speed" value="standard" checked />
									<span mix={[raw({ display: "grid", gap: "0.125rem" })]}>
										<span
											mix={[raw({ fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" })]}
										>
											Standard
										</span>
										<span mix={[raw({ fontSize: "0.875rem" })]}>{etaLabel(cart.restaurant)}</span>
									</span>
									<BikeIcon
										aria-hidden="true"
										size={18}
										mix={[raw({ color: "var(--ui-neutral-fg-subtle)" })]}
									/>
								</label>
								<label mix={radioCard()}>
									<input type="radio" name="speed" value="priority" />
									<span mix={[raw({ display: "grid", gap: "0.125rem" })]}>
										<span
											mix={[raw({ fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" })]}
										>
											Priority · +{money(PRIORITY_FEE)}
										</span>
										<span mix={[raw({ fontSize: "0.875rem" })]}>
											{Math.max(cart.restaurant.eta[0] - 5, 5)}–{cart.restaurant.eta[1] - 5} min,
											straight to you
										</span>
									</span>
									<ZapIcon
										aria-hidden="true"
										size={18}
										mix={[raw({ color: "var(--ui-brand-fg)" })]}
									/>
								</label>
							</Step>
							<Step n={3} title="Pay with">
								{PAYMENT_METHODS.map((method, index) => (
									<label mix={radioCard()}>
										<input
											type="radio"
											name="payment"
											value={method.id}
											checked={index === 0}
											required
										/>
										<span mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem" })]}>
											<PaymentIcon method={method} />
											<span mix={[raw({ display: "grid", gap: "0.0625rem" })]}>
												<span
													mix={[raw({ fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" })]}
												>
													{method.label}
												</span>
												<span
													mix={[
														raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
													]}
												>
													{method.detail}
												</span>
											</span>
										</span>
										<span />
									</label>
								))}
								<p
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
											margin: "0.25rem 0 0",
											fontSize: "0.8125rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									<LockIcon aria-hidden="true" size={14} />
									These are invented, saved methods. Bocado never asks for card details and charges
									nothing.
								</p>
							</Step>
							<Step n={4} title="Tip your courier">
								<p
									mix={[
										raw({
											margin: "-0.375rem 0 0.25rem",
											fontSize: "0.875rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									Every cent of the tip goes to the courier.
								</p>
								<div
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
											gap: "0.5rem",
										}),
									]}
								>
									{TIPS.map((tip) => (
										<label
											mix={[
												raw({
													display: "grid",
													justifyItems: "center",
													gap: "0.125rem",
													paddingBlock: "0.625rem",
													borderRadius: "0.875rem",
													boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
													cursor: "pointer",
													"& input": { position: "absolute", opacity: "0", pointerEvents: "none" },
													"&:has(input:checked)": {
														color: "var(--ui-brand-fg-on-solid, white)",
														backgroundColor: "var(--ui-brand-bg-solid)",
														boxShadow: "none",
													},
													"&:has(input:focus-visible)": {
														outline: "2px solid var(--ui-brand-ring)",
														outlineOffset: "2px",
													},
												}),
												when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
											]}
										>
											<input
												type="radio"
												name="tip"
												value={String(tip)}
												checked={tip === DEFAULT_TIP}
											/>
											<span mix={[raw({ fontWeight: "800" })]}>
												{tip === 0 ? "None" : `${tip}%`}
											</span>
											<span
												mix={[
													raw({
														fontSize: "0.75rem",
														opacity: "0.8",
														fontVariantNumeric: "tabular-nums",
													}),
												]}
											>
												{money(percentOf(totals.subtotal, tip))}
											</span>
										</label>
									))}
								</div>
							</Step>
						</div>
						<Panel sticky label="Order summary">
							<h2 mix={[raw({ margin: "0 0 0.875rem", fontSize: "1.0625rem", fontWeight: "800" })]}>
								{cart.restaurant.name}
							</h2>
							<OrderItems cart={cart} />
							<Summary totals={totals} tip={DEFAULT_TIP} />
							<button
								type="submit"
								data-place-order=""
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										inlineSize: "100%",
										blockSize: "3.25rem",
										marginBlockStart: "1.25rem",
										paddingInline: "1.25rem",
										border: "0",
										borderRadius: "999px",
										font: "inherit",
										fontSize: "1rem",
										fontWeight: "800",
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
								]}
							>
								<span>Place order</span>
								<span data-place-total="" mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
									{money(totals.total)}
								</span>
							</button>
						</Panel>
					</TwoColumns>
				</form>
				<CheckoutLive form="bocado-checkout" />
			</Gutter>
		);
	};
}
