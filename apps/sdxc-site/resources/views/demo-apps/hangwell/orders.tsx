/**
 * After the sale: an order's page (the thank-you right after checkout, and the order detail
 * later) with print files ready to download beside the parcel's tracking, guest tracking by
 * order number and email, and returns that refund each line's exact share of a discount.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { QR } from "@sdxc/qr";
import { QrCode } from "@sdxc/qr/ui";
import { isSuccess } from "@sdxc/result";
import { raw } from "@sdxc/u/general";
import { Amount } from "@sdxc/ui";
import { CartLine } from "@sdxc/ui/commerce/cart-line";
import { FulfilmentNote } from "@sdxc/ui/commerce/fulfilment-note";
import { OrderSteps } from "@sdxc/ui/commerce/order-tracker";
import { LinkButton } from "@sdxc/ui/link-button";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";

import type { Order, Return, Totals, Visitor } from "./state";

import { FramedArt, PosterArt } from "./art";
import {
	CURRENCY,
	LOCALE,
	SHOPPER,
	actionHref,
	countryName,
	fileHref,
	findPayment,
	findShipping,
	href,
	money,
	variantName,
} from "./data";
import { DemoNote, Gutter, PageTitle, WALL } from "./parts";
import { addWorkingDays, shortDay } from "./product";
import { isPhysical, linePoster, lineTotal, priceCart } from "./state";

/** Minutes after placement each parcel step is reached; the demo runs a week in a quarter hour. */
const STEP_MINUTES = {
	placed: 0,
	printing: 1,
	framing: 3,
	shipped: 6,
	out: 10,
	delivered: 14,
} as const;

/** A parcel step's id. */
type ParcelStep = keyof typeof STEP_MINUTES;

/** How long a return can be started after delivery. */
const RETURN_DAYS = 30;

/** The reasons a return form offers. */
export const RETURN_REASONS = [
	{ id: "size", label: "Wrong size for the wall" },
	{ id: "colour", label: "Colours look different in my room" },
	{ id: "damaged", label: "Arrived damaged" },
	{ id: "changed", label: "Changed my mind" },
];

/** An order's totals, priced the way checkout priced it. */
export function orderTotals(order: Order): Totals {
	return priceCart(order.lines, order.promo, order.draft.shipping);
}

/** The parcel steps an order goes through: framing only when something is framed. */
function parcelSteps(order: Order): ParcelStep[] {
	let framed = order.lines.some((line) => line.variant.format === "framed");
	return framed
		? ["placed", "printing", "framing", "shipped", "out", "delivered"]
		: ["placed", "printing", "shipped", "out", "delivered"];
}

/** The step an order's parcel has reached at a moment. */
export function parcelStep(order: Order, now: number): ParcelStep {
	let minutes = (now - order.placedAt) / 60_000;
	let reached: ParcelStep = "placed";
	for (let step of parcelSteps(order)) if (minutes >= STEP_MINUTES[step]) reached = step;
	return reached;
}

/** Whether every physical line of an order has arrived. */
export function isDelivered(order: Order, now: number): boolean {
	return parcelStep(order, now) === "delivered";
}

/** The step names a shopper reads. */
const STEP_LABELS: Record<ParcelStep, string> = {
	placed: "Order placed",
	printing: "Printing",
	framing: "Framing by hand",
	shipped: "Shipped",
	out: "Out for delivery",
	delivered: "Delivered",
};

/** A time like "19 Nov, 14:05" in the studio's zone. */
function stamp(time: number): string {
	return new Intl.DateTimeFormat(LOCALE, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Lisbon",
	}).format(time);
}

/** Where a parcel was scanned at each step. */
function scanPlace(step: ParcelStep, order: Order): string {
	if (step === "placed") return "Online";
	if (step === "printing" || step === "framing") return "Hangwell studio, Porto";
	if (step === "shipped") return "Porto sorting centre";
	return `${order.draft.city || "Local"} delivery depot`;
}

/** The parcel's timeline with a time and a place under each step reached. */
function ParcelTracker(handle: Handle<{ order: Order; now: number }>) {
	return () => {
		let { now, order } = handle.props;
		let reached = parcelStep(order, now);
		let steps = parcelSteps(order);
		let at = steps.indexOf(reached);
		return (
			<OrderSteps
				current={reached}
				steps={steps.map((step, index) => ({
					id: step,
					label: STEP_LABELS[step],
					detail:
						index <= at
							? `${stamp(order.placedAt + STEP_MINUTES[step] * 60_000)} · ${scanPlace(step, order)}`
							: undefined,
				}))}
			/>
		);
	};
}

/** A line's picture. */
function LineArt(handle: Handle<{ order: Order; index: number }>) {
	return () => {
		let line = handle.props.order.lines[handle.props.index]!;
		let poster = linePoster(line);
		return line.variant.format === "framed" ? (
			<FramedArt poster={poster} frame={line.variant.frame} mount={line.variant.mount} />
		) : (
			<PosterArt poster={poster} />
		);
	};
}

/** An order's totals as a breakdown. */
function OrderBreakdown(handle: Handle<{ order: Order }>) {
	return () => {
		let { order } = handle.props;
		let totals = orderTotals(order);
		return (
			<PriceBreakdown
				note={`Includes ${money(totals.vat)} VAT. Paid with ${findPayment(order.draft.payment)?.name ?? "a demo method"}.`}
			>
				<PriceBreakdown.Line label="Subtotal" amount={money(totals.subtotal)} />
				{totals.discount === 0 ? null : (
					<PriceBreakdown.Line
						label={totals.promo?.label ?? "Discount"}
						amount={money(totals.discount)}
						tone="discount"
					/>
				)}
				{totals.shipping === null ? null : (
					<PriceBreakdown.Line
						label={`Shipping · ${findShipping(order.draft.shipping)?.name ?? "Standard"}`}
						amount={
							totals.shipping + totals.oversize === 0
								? "Free"
								: money(totals.shipping + totals.oversize)
						}
					/>
				)}
				<PriceBreakdown.Total label="Total" amount={money(totals.total)} />
			</PriceBreakdown>
		);
	};
}

/** A titled card on an order page. */
function Panel(handle: Handle<{ title: RemixNode; children: RemixNode; id?: string }>) {
	return () => (
		<section
			aria-labelledby={handle.props.id}
			mix={[
				raw({
					display: "grid",
					gap: "1rem",
					alignContent: "start",
					padding: "1.5rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
				}),
			]}
		>
			<h2
				id={handle.props.id}
				mix={[raw({ margin: "0", fontSize: "1.125rem", fontWeight: "600" })]}
			>
				{handle.props.title}
			</h2>
			{handle.props.children}
		</section>
	);
}

/** The parcel panel's heading for where the parcel stands. */
function parcelTitle(delivered: boolean, method: string | undefined): string {
	if (delivered) return "Delivered";
	return method === "pickup" ? "Pick up at the studio" : "On its way";
}

/** The lead under an order's title: the receipt note at first, its state later. */
function orderLead(order: Order, now: number, fresh: boolean, downloads: boolean): string {
	if (fresh)
		return `We've sent a receipt to ${order.draft.email || SHOPPER.email}.${downloads ? " Your print files are ready below." : ""}`;
	if (!order.lines.some(isPhysical)) return "Print files, ready to download any time.";
	return `${STEP_LABELS[parcelStep(order, now)]}.`;
}

namespace OrderPage {
	export interface Props {
		order: Order;
		visitor: Visitor;
		now: number;
	}
}

/** An order: the thank-you right after it was placed, the order detail after that. */
export function OrderPage(handle: Handle<OrderPage.Props>) {
	return () => {
		let { now, order, visitor } = handle.props;
		let fresh = now - order.placedAt < 30 * 60_000;
		let digital = order.lines
			.map((line, index) => ({ line, index }))
			.filter(({ line }) => !isPhysical(line));
		let physical = order.lines.some(isPhysical);
		let delivered = isDelivered(order, now);
		let returnOpen = physical && delivered && now - order.placedAt < RETURN_DAYS * 86_400_000;
		let returns = visitor.returns.filter((entry) => entry.order === order.id);
		let estimate = findShipping(order.draft.shipping);
		return (
			<Gutter narrow>
				<PageTitle
					eyebrow={`Order ${order.number} · ${stamp(order.placedAt)}`}
					lead={orderLead(order, now, fresh, digital.length > 0)}
				>
					{fresh
						? `Thank you, ${(order.draft.name || SHOPPER.name).split(" ")[0]}.`
						: `Order ${order.number}`}
				</PageTitle>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "1.25rem",
							"@media (min-width: 48rem)": { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" },
						}),
					]}
				>
					{digital.length === 0 ? null : (
						<Panel title="Your downloads" id="hw-downloads">
							<ul
								mix={[
									raw({
										listStyle: "none",
										margin: "0",
										padding: "0",
										display: "grid",
										gap: "0.75rem",
									}),
								]}
							>
								{digital.map(({ line }) => {
									let poster = linePoster(line);
									return (
										<li
											mix={[
												raw({
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													gap: "0.75rem",
												}),
											]}
										>
											<span mix={[raw({ display: "grid" })]}>
												<strong mix={[raw({ fontWeight: "600" })]}>{poster.title}</strong>
												<span
													mix={[
														raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
													]}
												>
													Print file · SVG, watermarked for the demo
												</span>
											</span>
											<a
												href={fileHref(`orders/${order.id}/${poster.id}.svg`)}
												download={`${poster.id}.svg`}
												data-rmx-document=""
												mix={[
													raw({
														flex: "none",
														paddingInline: "1rem",
														blockSize: "2.5rem",
														display: "inline-flex",
														alignItems: "center",
														borderRadius: "var(--ui-cta-radius)",
														color: "var(--ui-bg)",
														backgroundColor: "var(--ui-neutral-fg-emphasis)",
														textDecoration: "none",
														fontWeight: "600",
													}),
												]}
											>
												Download
											</a>
										</li>
									);
								})}
							</ul>
							<p
								mix={[
									raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
								]}
							>
								They also stay in your library.
							</p>
						</Panel>
					)}
					{physical ? (
						<Panel title={parcelTitle(delivered, estimate?.id)} id="hw-parcel">
							<ParcelTracker order={order} now={now} />
							{delivered || estimate === undefined ? null : (
								<FulfilmentNote kind={estimate.id === "pickup" ? "pickup" : "ships"}>
									{estimate.id === "pickup"
										? "Rua das Flores, Porto"
										: `Expected ${shortDay(addWorkingDays(order.placedAt, estimate.days[1]))}`}
								</FulfilmentNote>
							)}
						</Panel>
					) : null}
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "1.25rem",
							marginBlockStart: "1.25rem",
							"@media (min-width: 48rem)": { gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" },
						}),
					]}
				>
					<Panel title="What you ordered" id="hw-lines">
						<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
							{order.lines.map((line, index) => (
								<CartLine
									name={linePoster(line).title}
									details={`${variantName(linePoster(line), line.variant)}${line.qty > 1 ? ` · × ${line.qty}` : ""}`}
									price={<Amount value={lineTotal(line)} currency={CURRENCY} locale={LOCALE} />}
									media={<LineArt order={order} index={index} />}
									mediaBackground={WALL}
								/>
							))}
						</ul>
						<OrderBreakdown order={order} />
					</Panel>
					<div mix={[raw({ display: "grid", gap: "1.25rem", alignContent: "start" })]}>
						{physical ? (
							<Panel title="Ship to" id="hw-ship-to">
								<p mix={[raw({ margin: "0", lineHeight: "1.6" })]}>
									{order.draft.name}
									<br />
									{order.draft.line1} {order.draft.line2}
									<br />
									{order.draft.postcode} {order.draft.city}, {countryName(order.draft.country)}
								</p>
							</Panel>
						) : null}
						<div mix={[raw({ display: "grid", gap: "0.75rem" })]}>
							<form method="post" action={actionHref(`orders/${order.id}/reorder`)}>
								<button
									type="submit"
									mix={[
										raw({
											inlineSize: "100%",
											blockSize: "3rem",
											border: "1px solid var(--ui-neutral-fg-emphasis)",
											borderRadius: "var(--ui-cta-radius)",
											background: "none",
											font: "inherit",
											fontWeight: "600",
											color: "inherit",
											cursor: "pointer",
										}),
									]}
								>
									Buy it again
								</button>
							</form>
							{returnOpen ? (
								<LinkButton href={href(`account/orders/${order.id}/return`)} variant="outline">
									Start a return
								</LinkButton>
							) : null}
							{!returnOpen && physical && !delivered ? (
								<p
									mix={[
										raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
									]}
								>
									You can start a return once it's delivered.
								</p>
							) : null}
							{returns.map((entry) => (
								<a
									href={href(`account/returns/${entry.id}`)}
									mix={[raw({ color: "inherit", fontWeight: "500" })]}
								>
									Return {entry.id} started · see the label
								</a>
							))}
						</div>
					</div>
				</div>
			</Gutter>
		);
	};
}

namespace TrackPage {
	export interface Props {
		visitor: Visitor;
		url: URL;
		now: number;
	}
}

/** Guest tracking: an order number and the email it was placed with. */
export function TrackPage(handle: Handle<TrackPage.Props>) {
	return () => {
		let { now, url, visitor } = handle.props;
		let number = (url.searchParams.get("order") ?? "").trim().toUpperCase();
		let email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
		let asked = number !== "" || email !== "";
		let found = visitor.orders.find(
			(order) =>
				order.number === number && (order.draft.email || SHOPPER.email).toLowerCase() === email,
		);
		return (
			<Gutter narrow>
				<PageTitle lead="No account needed: the order number is in your receipt email.">
					Track an order
				</PageTitle>
				<form
					method="get"
					action={href("track")}
					mix={[
						raw({
							display: "grid",
							gap: "0.75rem",
							maxInlineSize: "28rem",
							"& label": { fontSize: "0.875rem", fontWeight: "500" },
							"& input": {
								blockSize: "3rem",
								paddingInline: "0.875rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-md)",
								font: "inherit",
								backgroundColor: "var(--ui-bg)",
								color: "inherit",
							},
						}),
					]}
				>
					<label htmlFor="hw-track-order">Order number</label>
					<input id="hw-track-order" name="order" value={number} placeholder="HW-40312" required />
					<label htmlFor="hw-track-email">Email</label>
					<input
						id="hw-track-email"
						name="email"
						type="email"
						value={email}
						placeholder="maya@example.com"
						autocomplete="email"
						required
					/>
					<button
						type="submit"
						mix={[
							raw({
								blockSize: "3rem",
								border: "0",
								borderRadius: "var(--ui-cta-radius)",
								font: "inherit",
								fontWeight: "600",
								color: "var(--ui-bg)",
								backgroundColor: "var(--ui-neutral-fg-emphasis)",
								cursor: "pointer",
							}),
						]}
					>
						Track
					</button>
					<p
						mix={[raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						Try HW-40312 with maya@example.com.
					</p>
				</form>
				<div mix={[raw({ marginBlockStart: "2rem" })]} aria-live="polite">
					{asked && found === undefined ? (
						<p
							role="alert"
							mix={[
								raw({
									margin: "0",
									padding: "1rem",
									borderRadius: "var(--ui-radius-md)",
									backgroundColor: "var(--ui-neutral-bg-tint)",
								}),
							]}
						>
							No order {number || "with that number"} matches that email. Check both against your
							receipt.
						</p>
					) : null}
					{found === undefined ? null : (
						<Panel title={`Order ${found.number}`} id="hw-track-result">
							{found.lines.some(isPhysical) ? (
								<ParcelTracker order={found} now={now} />
							) : (
								<p mix={[raw({ margin: "0" })]}>
									This order only has print files. They're in your receipt email.
								</p>
							)}
							<a
								href={href(`orders/${found.id}`)}
								mix={[raw({ color: "inherit", fontWeight: "500" })]}
							>
								See the whole order
							</a>
						</Panel>
					)}
				</div>
			</Gutter>
		);
	};
}

/** What a return refunds per line: the line's price minus its share of the order's discount. */
export function lineRefunds(order: Order): number[] {
	let totals = orderTotals(order);
	return order.lines.map((line, index) => lineTotal(line) - (totals.lineDiscounts[index] ?? 0));
}

/** The next five working days a courier can collect a return, as `YYYY-MM-DD`. */
export function pickupDays(now: number): string[] {
	return [1, 2, 3, 4, 5].map((days) => addWorkingDays(now, days).toISOString().slice(0, 10));
}

/** One way a return goes back, as a radio card. */
function MethodOption(
	handle: Handle<{ value: string; checked: boolean; title: string; detail: string }>,
) {
	return () => (
		<label
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "auto minmax(0, 1fr)",
					columnGap: "0.75rem",
					padding: "0.875rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-md)",
					"&:has(:checked)": { borderColor: "var(--ui-neutral-fg-emphasis)" },
					"& > span": {
						gridColumn: "2",
						fontSize: "0.875rem",
						color: "var(--ui-neutral-fg-muted)",
					},
				}),
			]}
		>
			<input type="radio" name="method" value={handle.props.value} checked={handle.props.checked} />
			<strong>{handle.props.title}</strong>
			<span>{handle.props.detail}</span>
		</label>
	);
}

namespace ReturnPage {
	export interface Props {
		order: Order;
		url: URL;
		now: number;
		error?: string;
	}
}

/**
 * Starting a return: pick the lines, a reason and how it goes back. The refund preview shows
 * each line's price less its exact share of any discount; "Update refund" is a GET to the same
 * page so the preview works without script, and "Start return" posts.
 */
export function ReturnPage(handle: Handle<ReturnPage.Props>) {
	return () => {
		let { error, now, order, url } = handle.props;
		let refunds = lineRefunds(order);
		let chosen = url.searchParams
			.getAll("line")
			.map(Number)
			.filter((index) => order.lines[index] !== undefined && isPhysical(order.lines[index]!));
		let totals = orderTotals(order);
		let reason = url.searchParams.get("reason") ?? "";
		let method = url.searchParams.get("method") === "pickup" ? "pickup" : "dropoff";
		let day = url.searchParams.get("day") ?? "";
		let refund = chosen.reduce((sum, index) => sum + (refunds[index] ?? 0), 0);
		return (
			<Gutter narrow>
				<PageTitle
					eyebrow={`Order ${order.number}`}
					lead="Prints and frames go back within 30 days of delivery. Print files can't be returned."
				>
					Start a return
				</PageTitle>
				<form
					method="get"
					action={href(`account/orders/${order.id}/return`)}
					mix={[raw({ display: "grid", gap: "1.5rem" })]}
				>
					{error === undefined ? null : (
						<p
							role="alert"
							mix={[
								raw({
									margin: "0",
									padding: "0.75rem 1rem",
									borderRadius: "var(--ui-radius-md)",
									backgroundColor: "oklch(0.96 0.03 25)",
									color: "oklch(0.45 0.16 25)",
								}),
							]}
						>
							{error}
						</p>
					)}
					<fieldset
						mix={[raw({ margin: "0", padding: "0", border: "0", display: "grid", gap: "0.5rem" })]}
					>
						<legend mix={[raw({ fontWeight: "600", marginBlockEnd: "0.5rem" })]}>
							What's going back?
						</legend>
						{order.lines.map((line, index) => {
							let poster = linePoster(line);
							let returnable = isPhysical(line);
							return (
								<label
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "auto 3rem minmax(0, 1fr) auto",
											alignItems: "center",
											gap: "0.75rem",
											padding: "0.75rem",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "var(--ui-radius-md)",
											opacity: returnable ? "1" : "0.55",
											"&:has(:checked)": { borderColor: "var(--ui-neutral-fg-emphasis)" },
										}),
									]}
								>
									<input
										type="checkbox"
										name="line"
										value={String(index)}
										checked={chosen.includes(index)}
										disabled={!returnable}
									/>
									<span
										mix={[
											raw({
												display: "block",
												padding: "0.25rem",
												backgroundColor: WALL,
												borderRadius: "var(--ui-radius-sm)",
											}),
										]}
									>
										<LineArt order={order} index={index} />
									</span>
									<span mix={[raw({ display: "grid" })]}>
										<strong mix={[raw({ fontWeight: "600" })]}>{poster.title}</strong>
										<span
											mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
										>
											{returnable
												? variantName(poster, line.variant)
												: "Print file · can't be returned"}
										</span>
									</span>
									<span mix={[raw({ fontVariantNumeric: "tabular-nums", fontWeight: "500" })]}>
										{money(refunds[index] ?? 0)}
									</span>
								</label>
							);
						})}
					</fieldset>
					<div mix={[raw({ display: "grid", gap: "0.375rem", maxInlineSize: "24rem" })]}>
						<label htmlFor="hw-reason" mix={[raw({ fontWeight: "600" })]}>
							Why?
						</label>
						<select
							id="hw-reason"
							name="reason"
							mix={[
								raw({
									blockSize: "3rem",
									paddingInline: "0.75rem",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-md)",
									font: "inherit",
									backgroundColor: "var(--ui-bg)",
									color: "inherit",
								}),
							]}
						>
							<option value="">Choose a reason</option>
							{RETURN_REASONS.map((entry) => (
								<option value={entry.id} selected={reason === entry.id}>
									{entry.label}
								</option>
							))}
						</select>
					</div>
					<fieldset
						mix={[raw({ margin: "0", padding: "0", border: "0", display: "grid", gap: "0.5rem" })]}
					>
						<legend mix={[raw({ fontWeight: "600", marginBlockEnd: "0.5rem" })]}>
							How it goes back
						</legend>
						<MethodOption
							value="dropoff"
							checked={method === "dropoff"}
							title="Drop it off"
							detail="At any parcel point with the QR code we give you. Free."
						/>
						<MethodOption
							value="pickup"
							checked={method === "pickup"}
							title="Have it collected"
							detail={`A courier collects it from ${order.draft.city || "your address"}. Free for frames.`}
						/>
					</fieldset>
					<fieldset
						mix={[raw({ margin: "0", padding: "0", border: "0", display: "grid", gap: "0.5rem" })]}
					>
						<legend mix={[raw({ fontWeight: "600", marginBlockEnd: "0.5rem" })]}>
							Collection day, if collected
						</legend>
						<span mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.375rem" })]}>
							{pickupDays(now).map((date) => (
								<label
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											gap: "0.375rem",
											paddingInline: "0.75rem",
											blockSize: "2.25rem",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "999px",
											fontSize: "0.875rem",
											"&:has(:checked)": {
												borderColor: "var(--ui-neutral-fg-emphasis)",
												backgroundColor: "var(--ui-neutral-bg-tint)",
											},
										}),
									]}
								>
									<input type="radio" name="day" value={date} checked={day === date} />
									{shortDay(new Date(`${date}T12:00:00Z`))}
								</label>
							))}
						</span>
					</fieldset>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "0.75rem",
								padding: "1.25rem",
								borderRadius: "var(--ui-radius-lg)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
							}),
						]}
					>
						<PriceBreakdown
							note={
								totals.discount === 0
									? "Refunded to the original payment method. Shipping isn't refunded."
									: `Each line is refunded less its share of ${totals.promo?.code ?? "the discount"}. Shipping isn't refunded.`
							}
						>
							{chosen.length === 0 ? (
								<PriceBreakdown.Line label="Nothing chosen yet" amount={money(0)} />
							) : (
								chosen.map((index) => (
									<PriceBreakdown.Line
										label={linePoster(order.lines[index]!).title}
										detail={
											totals.lineDiscounts[index]
												? `${money(lineTotal(order.lines[index]!))} less ${money(totals.lineDiscounts[index] ?? 0)} discount`
												: undefined
										}
										amount={money(refunds[index] ?? 0)}
									/>
								))
							)}
							<PriceBreakdown.Total label="Refund" amount={money(refund)} name="refund" />
						</PriceBreakdown>
						<div
							mix={[
								raw({ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "end" }),
							]}
						>
							<button
								type="submit"
								mix={[
									raw({
										blockSize: "3rem",
										paddingInline: "1.25rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-cta-radius)",
										background: "var(--ui-bg)",
										font: "inherit",
										fontWeight: "500",
										color: "inherit",
										cursor: "pointer",
									}),
								]}
							>
								Update refund
							</button>
							<button
								type="submit"
								formmethod="post"
								formaction={actionHref(`account/orders/${order.id}/return`)}
								mix={[
									raw({
										blockSize: "3rem",
										paddingInline: "1.5rem",
										border: "0",
										borderRadius: "var(--ui-cta-radius)",
										font: "inherit",
										fontWeight: "600",
										color: "var(--ui-bg)",
										backgroundColor: "var(--ui-neutral-fg-emphasis)",
										cursor: "pointer",
									}),
								]}
							>
								Start return
							</button>
						</div>
					</div>
					<DemoNote>
						Starting a return here refunds nothing; it shows how the refund is worked out.
					</DemoNote>
				</form>
			</Gutter>
		);
	};
}

namespace ReturnLabel {
	export interface Props {
		entry: Return;
		order: Order;
	}
}

/** A started return: its QR label, what to do with it, the refund and where it stands. */
export function ReturnLabel(handle: Handle<ReturnLabel.Props>) {
	return () => {
		let { entry, order } = handle.props;
		let refunds = lineRefunds(order);
		let refund = entry.lines.reduce((sum, index) => sum + (refunds[index] ?? 0), 0);
		let code = QR.encode(`HANGWELL-RETURN-${entry.id}`);
		return (
			<Gutter narrow>
				<PageTitle
					eyebrow={`Order ${order.number}`}
					lead={
						entry.method === "pickup"
							? `A courier collects it on ${shortDay(new Date(`${entry.day}T12:00:00Z`))}. Have it packed in the box it came in.`
							: "Show this code at any parcel point. No printing needed."
					}
				>
					Return {entry.id}
				</PageTitle>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "1.5rem",
							"@media (min-width: 48rem)": {
								gridTemplateColumns: "auto minmax(0, 1fr)",
								alignItems: "start",
							},
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "grid",
								justifyItems: "center",
								gap: "0.5rem",
								padding: "1.5rem",
								border: "1px dashed var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg)",
								backgroundColor: "white",
								color: "black",
							}),
						]}
					>
						{isSuccess(code) ? (
							<QrCode
								path={code.data.toSVGPath()}
								label={`Return code for ${entry.id}`}
								size="12rem"
							/>
						) : null}
						<strong mix={[raw({ fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em" })]}>
							{entry.id}
						</strong>
					</div>
					<div mix={[raw({ display: "grid", gap: "1.25rem" })]}>
						<OrderSteps
							current="started"
							steps={[
								{ id: "started", label: "Return started", detail: stamp(entry.startedAt) },
								{ id: "sent", label: entry.method === "pickup" ? "Collected" : "Dropped off" },
								{ id: "received", label: "Received at the studio" },
								{ id: "refunded", label: `Refunded ${money(refund)}` },
							]}
						/>
						<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
							{entry.lines.map((index) => {
								let line = order.lines[index];
								if (line === undefined) return null;
								return (
									<CartLine
										name={linePoster(line).title}
										details={variantName(linePoster(line), line.variant)}
										price={
											<Amount value={refunds[index] ?? 0} currency={CURRENCY} locale={LOCALE} />
										}
										media={<LineArt order={order} index={index} />}
										mediaBackground={WALL}
									/>
								);
							})}
						</ul>
						<a
							href={href(`orders/${order.id}`)}
							mix={[raw({ color: "inherit", fontWeight: "500" })]}
						>
							Back to the order
						</a>
					</div>
				</div>
			</Gutter>
		);
	};
}
