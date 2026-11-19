/**
 * An order's live tracking and the order history. Tracking shows the courier's route on a
 * street map, the status timeline and the receipt, following the server's progress stream;
 * the history lists every order with Reorder, and Track for one still on its way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BikeIcon, MessageCircleIcon, PhoneIcon, RotateCcwIcon, StarIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LinkButton } from "@sdxc/ui";
import { OrderLive, OrderSteps } from "@sdxc/ui/commerce/order-tracker";

import type { Order } from "./data";
import type { Visitor } from "./state";

import { DishArt } from "./art";
import { Summary } from "./checkout";
import {
	actionHref,
	findAddress,
	findItem,
	findPayment,
	findRestaurant,
	href,
	money,
	streamHref,
} from "./data";
import { DeliveryMap } from "./delivery-map";
import { CARD_RADIUS, Gutter } from "./parts";
import { choiceSummary, lineCount, priceLines } from "./state";
import { COURIER, STEPS, orderProgress } from "./tracking";

/** The id of the element the live island updates. */
const TRACK_ROOT = "bocado-track";

/** When an order was placed, as its receipt says it. */
function placedLabel(order: Order, now: number): string {
	let minutes = Math.round((now - order.placedAt) / 60000);
	if (minutes < 1) return "Placed just now";
	if (minutes < 60) return `Placed ${minutes} min ago`;
	let days = Math.round(minutes / (60 * 24));
	if (days < 1) return `Placed ${Math.round(minutes / 60)} h ago`;
	return days === 1 ? "Placed yesterday" : `Placed ${days} days ago`;
}

/** The short number an order is called by, from the end of its id. */
export function orderNumber(order: Order): string {
	return `#${order.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

namespace TrackingPage {
	export interface Props {
		order: Order;
		now: number;
	}
}

/**
 * Renders an order's tracking: the headline and arrival time, the map, the courier, the
 * timeline and the receipt. While the order is on its way, the live island follows its stream.
 */
export function TrackingPage(handle: Handle<TrackingPage.Props>) {
	return () => {
		let { now, order } = handle.props;
		let restaurant = findRestaurant(order.restaurant)!;
		let address = findAddress(order.address)!;
		let payment = findPayment(order.payment);
		let progress = orderProgress(order, now);
		let totals = priceLines(restaurant, order.lines, { tip: order.tip, priority: order.priority });
		return (
			<Gutter>
				<div
					id={TRACK_ROOT}
					data-order-state={progress.step.id}
					mix={[
						raw({
							display: "grid",
							gap: "1.5rem",
							paddingBlockStart: "1.5rem",
							"& [data-map-marker]": { transition: "opacity 300ms ease" },
							"&:is([data-order-state='placed'], [data-order-state='accepted'], [data-order-state='preparing']) [data-map-marker]":
								{ opacity: "0" },
							"@media (min-width: 60rem)": {
								gridTemplateColumns: "minmax(0, 1fr) 22rem",
								alignItems: "start",
								gap: "2rem",
							},
						}),
					]}
				>
					<div mix={[raw({ display: "grid", gap: "1rem", minInlineSize: "0" })]}>
						<div
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "end",
									justifyContent: "space-between",
									gap: "0.75rem",
								}),
							]}
						>
							<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
								<p
									mix={[
										raw({
											margin: "0",
											fontSize: "0.875rem",
											fontWeight: "650",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{restaurant.name} · {orderNumber(order)}
								</p>
								<h1
									data-order-headline=""
									aria-live="polite"
									mix={[
										raw({
											margin: "0",
											fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)",
											fontWeight: "800",
											letterSpacing: "-0.03em",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									{progress.step.headline}
								</h1>
							</div>
							<div
								mix={[
									raw({
										display: "grid",
										justifyItems: "end",
										padding: "0.5rem 0.875rem",
										borderRadius: "0.875rem",
										backgroundColor: "var(--ui-brand-bg-subtle)",
										color: "var(--ui-brand-fg)",
									}),
								]}
							>
								<span
									mix={[
										raw({
											fontSize: "0.75rem",
											fontWeight: "700",
											textTransform: "uppercase",
											letterSpacing: "0.06em",
										}),
									]}
									data-order-eta-label=""
								>
									{progress.done ? "Delivered" : "Arriving in"}
								</span>
								<span
									data-order-eta=""
									mix={[
										raw({
											fontSize: "1.375rem",
											fontWeight: "800",
											fontVariantNumeric: "tabular-nums",
										}),
									]}
								>
									{progress.done ? "Arrived" : `${progress.eta} min`}
								</span>
							</div>
						</div>
						<DeliveryMap restaurant={restaurant} address={address} courier={progress.courier} />
						<div
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "3rem minmax(0, 1fr) auto",
									alignItems: "center",
									gap: "0.875rem",
									padding: "0.875rem 1rem",
									borderRadius: CARD_RADIUS,
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								}),
							]}
						>
							<span
								aria-hidden="true"
								mix={[
									raw({
										display: "grid",
										placeItems: "center",
										inlineSize: "3rem",
										blockSize: "3rem",
										borderRadius: "999px",
										fontWeight: "800",
										fontSize: "1.125rem",
										color: "white",
										background: "linear-gradient(145deg, oklch(0.72 0.14 50), oklch(0.55 0.18 20))",
									}),
								]}
							>
								L
							</span>
							<span mix={[raw({ display: "grid", gap: "0.125rem" })]}>
								<span mix={[raw({ fontWeight: "750", color: "var(--ui-neutral-fg-emphasis)" })]}>
									{COURIER.name} is your courier
								</span>
								<span
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											gap: "0.375rem",
											fontSize: "0.875rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									<BikeIcon aria-hidden="true" size={14} /> {COURIER.vehicle} ·
									<StarIcon aria-hidden="true" size={13} /> {COURIER.rating}
								</span>
							</span>
							<span mix={[raw({ display: "flex", gap: "0.375rem" })]}>
								<span
									aria-label="Messaging is off in the demo"
									title="Messaging is off in the demo"
									mix={[
										raw({
											display: "grid",
											placeItems: "center",
											inlineSize: "2.5rem",
											blockSize: "2.5rem",
											borderRadius: "999px",
											backgroundColor: "var(--ui-neutral-bg-subtle)",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									<MessageCircleIcon aria-hidden="true" size={17} />
								</span>
								<span
									aria-label="Calling is off in the demo"
									title="Calling is off in the demo"
									mix={[
										raw({
											display: "grid",
											placeItems: "center",
											inlineSize: "2.5rem",
											blockSize: "2.5rem",
											borderRadius: "999px",
											backgroundColor: "var(--ui-neutral-bg-subtle)",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									<PhoneIcon aria-hidden="true" size={17} />
								</span>
							</span>
						</div>
					</div>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "1rem",
								"@media (min-width: 60rem)": { position: "sticky", insetBlockStart: "5.5rem" },
							}),
						]}
					>
						<section
							aria-labelledby="bocado-status"
							mix={[
								raw({
									padding: "1.25rem",
									borderRadius: CARD_RADIUS,
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								}),
							]}
						>
							<h2
								id="bocado-status"
								mix={[raw({ margin: "0 0 1rem", fontSize: "1.0625rem", fontWeight: "800" })]}
							>
								Order status
							</h2>
							<OrderSteps steps={[...STEPS]} current={progress.step.id} />
						</section>
						<section
							aria-labelledby="bocado-receipt"
							mix={[
								raw({
									padding: "1.25rem",
									borderRadius: CARD_RADIUS,
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								}),
							]}
						>
							<h2
								id="bocado-receipt"
								mix={[raw({ margin: "0 0 0.25rem", fontSize: "1.0625rem", fontWeight: "800" })]}
							>
								Receipt
							</h2>
							<p
								mix={[
									raw({
										margin: "0 0 0.875rem",
										fontSize: "0.8125rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								{placedLabel(order, now)} · to {address.label} · {payment?.label ?? "Saved method"}
							</p>
							<ul
								mix={[
									raw({
										display: "grid",
										gap: "0.375rem",
										margin: "0 0 0.75rem",
										padding: "0 0 0.75rem",
										listStyle: "none",
										fontSize: "0.875rem",
										borderBlockEnd: "1px solid var(--ui-neutral-border)",
									}),
								]}
							>
								{order.lines.map((line) => {
									let entry = findItem(restaurant, line.item);
									let picks = choiceSummary(restaurant, line);
									return (
										<li mix={[raw({ display: "grid", gap: "0.0625rem" })]}>
											<span
												mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}
											>
												{line.qty} × {entry?.name}
											</span>
											{picks === "" ? null : (
												<span
													mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}
												>
													{picks}
												</span>
											)}
										</li>
									);
								})}
							</ul>
							<Summary totals={totals} tip={order.tip} />
						</section>
						{progress.done ? null : (
							<a
								href={href(`orders/${order.id}`)}
								mix={[
									raw({
										fontSize: "0.875rem",
										fontWeight: "650",
										color: "var(--ui-brand-fg)",
										justifySelf: "start",
									}),
									when(":root[data-main-ready] &", raw({ display: "none" })),
								]}
							>
								Refresh status
							</a>
						)}
					</div>
				</div>
				{progress.done ? null : (
					<OrderLive
						src={streamHref(`orders/${order.id}`)}
						root={TRACK_ROOT}
						steps={STEPS.map((step) => step.id)}
						headlines={Object.fromEntries(STEPS.map((step) => [step.id, step.headline]))}
						labels={{
							arriving: "Arriving in",
							arrived: "Delivered",
							done: "Arrived",
							minutes: "{n} min",
						}}
					/>
				)}
			</Gutter>
		);
	};
}

namespace OrdersPage {
	export interface Props {
		visitor: Visitor;
		now: number;
	}
}

/** Renders the order history: on the way first, then every past order with Reorder. */
export function OrdersPage(handle: Handle<OrdersPage.Props>) {
	return () => {
		let { now, visitor } = handle.props;
		return (
			<Gutter>
				<div mix={[raw({ paddingBlock: "1.75rem 1.25rem" })]}>
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)",
								fontWeight: "800",
								letterSpacing: "-0.02em",
							}),
						]}
					>
						Orders
					</h1>
				</div>
				<ul
					mix={[
						raw({
							display: "grid",
							gap: "0.875rem",
							margin: "0",
							padding: "0",
							listStyle: "none",
							maxInlineSize: "48rem",
						}),
					]}
				>
					{visitor.orders.map((order) => {
						let restaurant = findRestaurant(order.restaurant);
						if (restaurant === undefined) return null;
						let progress = orderProgress(order, now);
						let totals = priceLines(restaurant, order.lines, {
							tip: order.tip,
							priority: order.priority,
						});
						let count = lineCount(order.lines);
						let names = order.lines
							.map((line) => findItem(restaurant, line.item)?.name)
							.filter((name): name is string => name !== undefined)
							.join(", ");
						return (
							<li
								data-order={order.id}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "3.5rem minmax(0, 1fr)",
										gap: "0.875rem 1rem",
										padding: "1rem",
										borderRadius: CARD_RADIUS,
										boxShadow: progress.done
											? "inset 0 0 0 1px var(--ui-neutral-border)"
											: "inset 0 0 0 2px var(--ui-color-brand-500)",
										"@media (min-width: 36rem)": {
											gridTemplateColumns: "3.5rem minmax(0, 1fr) auto",
											alignItems: "center",
										},
									}),
								]}
							>
								<span
									mix={[
										raw({
											inlineSize: "3.5rem",
											blockSize: "3.5rem",
											padding: "0.25rem",
											boxSizing: "border-box",
											borderRadius: "0.875rem",
											backgroundColor: restaurant.tones[0],
										}),
									]}
								>
									<DishArt dish={restaurant.dish} />
								</span>
								<span mix={[raw({ display: "grid", gap: "0.1875rem", minInlineSize: "0" })]}>
									<span
										mix={[
											raw({
												display: "flex",
												flexWrap: "wrap",
												alignItems: "center",
												gap: "0.5rem",
											}),
										]}
									>
										<a
											href={href(`orders/${order.id}`)}
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
										<span
											mix={[
												raw({
													paddingInline: "0.5rem",
													paddingBlock: "0.0625rem",
													borderRadius: "999px",
													fontSize: "0.75rem",
													fontWeight: "700",
													color: progress.done
														? "var(--ui-neutral-fg)"
														: "var(--ui-brand-fg-on-solid, white)",
													backgroundColor: progress.done
														? "var(--ui-neutral-bg-subtle)"
														: "var(--ui-brand-bg-solid)",
												}),
											]}
										>
											{progress.done ? "Delivered" : progress.step.label}
										</span>
									</span>
									<span
										mix={[
											raw({
												fontSize: "0.875rem",
												color: "var(--ui-neutral-fg)",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}),
										]}
									>
										{names}
									</span>
									<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
										{placedLabel(order, now)} · {count} {count === 1 ? "item" : "items"} ·{" "}
										{money(totals.total)} · {orderNumber(order)}
									</span>
								</span>
								<span
									mix={[
										raw({
											display: "flex",
											gap: "0.5rem",
											gridColumn: "1 / -1",
											"@media (min-width: 36rem)": { gridColumn: "auto" },
										}),
									]}
								>
									{progress.done ? null : (
										<LinkButton
											href={href(`orders/${order.id}`)}
											color="brand"
											data-main-scroll-top=""
										>
											Track
										</LinkButton>
									)}
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
													color: "var(--ui-neutral-fg-emphasis)",
													backgroundColor: "var(--ui-neutral-bg-subtle)",
													cursor: "pointer",
												}),
												when(
													"&:hover",
													raw({
														backgroundColor:
															"var(--ui-neutral-bg-muted, var(--ui-neutral-bg-subtle))",
													}),
												),
												when(
													"&:focus-visible",
													raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
												),
											]}
										>
											<RotateCcwIcon aria-hidden="true" size={15} />
											<span>Reorder</span>
										</button>
									</form>
								</span>
							</li>
						);
					})}
				</ul>
			</Gutter>
		);
	};
}
