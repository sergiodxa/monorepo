/**
 * Checkout: the trip being booked, a choice among the traveller's saved cards, a note to the
 * host and the price, confirmed by one post. The cards are invented and nothing is charged; the
 * page never asks for a card number, so there is nothing real to type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ChevronLeftIcon, LockIcon, ShieldCheckIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { PriceBreakdown } from "@sdxc/ui/price-breakdown";

import type { SavedCard, Stay } from "./data";
import type { RequestProblem } from "./pricing";
import type { Screen } from "./screen";

import { SAVED_CARDS, actionHref, hostOf, href, placeOf, typeLabel } from "./data";
import { addDays, formatDay } from "./days";
import { GUTTER, WIDE } from "./layout";
import { Rating, StayPhoto, Title } from "./parts";
import { checkRequest, money, quote } from "./pricing";
import { partyLabel, readSearch, tripQuery, withQuery } from "./query";
import { heldNights } from "./state";

/** What a checkout post sent back, re-rendered with its problems when it can't book. */
export interface CheckoutDraft {
	card?: string;
	message?: string;
	problems: Array<RequestProblem | { kind: "card"; message: string }>;
}

/** A saved card's drawn face: its brand colours, the last four digits and the expiry. */
function CardFace(handle: Handle<{ card: SavedCard }>) {
	return () => {
		let { card } = handle.props;
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "grid",
						alignContent: "space-between",
						flexShrink: "0",
						inlineSize: "4.5rem",
						aspectRatio: "1.586",
						padding: "0.375rem 0.5rem",
						boxSizing: "border-box",
						borderRadius: "0.5rem",
						background: `linear-gradient(135deg, ${card.tones[0]}, ${card.tones[1]})`,
						color: "white",
						fontSize: "0.625rem",
						fontWeight: "700",
						letterSpacing: "0.04em",
					}),
				]}
			>
				<span mix={[raw({ overflow: "hidden", textOverflow: "clip", whiteSpace: "nowrap" })]}>
					{card.brand === "Mastercard" ? "MC" : card.brand.toUpperCase()}
				</span>
				<span mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>•• {card.last4}</span>
			</span>
		);
	};
}

/** A section of checkout's left column, with a rule above all but the first. */
function Part(handle: Handle<{ title: string; id: string; children: RemixNode }>) {
	return () => (
		<section
			aria-labelledby={handle.props.id}
			mix={[
				raw({
					paddingBlock: "1.75rem",
					borderBlockStart: "1px solid var(--ui-neutral-border)",
					"&:first-of-type": { borderBlockStart: "0", paddingBlockStart: "0" },
				}),
			]}
		>
			<h2
				id={handle.props.id}
				mix={[
					raw({
						margin: "0 0 1rem",
						fontSize: "1.25rem",
						fontWeight: "650",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{handle.props.title}
			</h2>
			{handle.props.children}
		</section>
	);
}

namespace Checkout {
	export interface Props {
		stay: Stay;
		ctx: Screen;
		draft?: CheckoutDraft;
	}
}

/**
 * The checkout screen. A request the stay can't take, such as dates someone else just booked,
 * sends the visitor back to the listing with the reason rather than to a form they can't submit.
 */
export default function Checkout(handle: Handle<Checkout.Props>) {
	return () => {
		let { ctx, draft, stay } = handle.props;
		let search = readSearch(ctx.url.searchParams);
		let request = {
			start: search.start,
			end: search.end,
			adults: search.adults,
			children: search.children,
		};
		let problems = checkRequest(stay, request, ctx.today, heldNights(ctx.traveller, stay.id));
		let back = href(withQuery(`stay/${stay.id}`, tripQuery(search)));
		let host = hostOf(stay);
		let chosen = draft?.card ?? SAVED_CARDS[0]!.id;
		let cardProblem = draft?.problems.find((problem) => problem.kind === "card");
		return (
			<div
				mix={[
					raw({
						maxInlineSize: "70rem",
						marginInline: "auto",
						paddingInline: GUTTER,
						paddingBlockStart: "clamp(1.25rem, 3vw, 2.5rem)",
					}),
				]}
			>
				<a
					href={back}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							minBlockSize: "2.75rem",
							marginBlockEnd: "0.5rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
						}),
						when("&:hover", raw({ textDecoration: "underline" })),
					]}
				>
					<ChevronLeftIcon aria-hidden="true" size={18} />
					Back to {stay.name}
				</a>
				<Title>Confirm and pay</Title>
				{problems.length > 0 || search.start === undefined || search.end === undefined ? (
					<div
						role="alert"
						mix={[
							raw({
								marginBlockStart: "1.5rem",
								padding: "1.25rem",
								borderRadius: "1rem",
								backgroundColor: "var(--ui-danger-bg-tint)",
								color: "var(--ui-danger-fg)",
							}),
						]}
					>
						<p mix={[raw({ margin: "0 0 0.5rem", fontWeight: "650" })]}>
							This stay can't be booked as it is.
						</p>
						<ul mix={[raw({ margin: "0 0 0.75rem", paddingInlineStart: "1.25rem" })]}>
							{problems.map((problem) => (
								<li>{problem.message}</li>
							))}
						</ul>
						<a href={back} mix={[raw({ fontWeight: "650", color: "inherit" })]}>
							Change the dates or guests
						</a>
					</div>
				) : (
					<CheckoutForm
						stay={stay}
						ctx={ctx}
						chosen={chosen}
						message={draft?.message ?? ""}
						cardProblem={cardProblem?.message}
						hostName={host.name.split(" ")[0]!}
					/>
				)}
			</div>
		);
	};
}

namespace CheckoutForm {
	export interface Props {
		stay: Stay;
		ctx: Screen;
		chosen: string;
		message: string;
		cardProblem?: string;
		hostName: string;
	}
}

/** The form itself, once the request is known to be bookable: trip, payment, note, summary. */
function CheckoutForm(handle: Handle<CheckoutForm.Props>) {
	return () => {
		let { cardProblem, chosen, ctx, hostName, message, stay } = handle.props;
		let search = readSearch(ctx.url.searchParams);
		let start = search.start!;
		let end = search.end!;
		let price = quote(stay, start, end);
		let back = href(withQuery(`stay/${stay.id}`, tripQuery(search)));
		let refundBy = addDays(start, -7);
		return (
			<form
				method="post"
				action={actionHref(`book/${stay.id}`)}
				data-main-scroll-top=""
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						gap: "2rem 4rem",
						marginBlockStart: "2rem",
						alignItems: "start",
						"@media (min-width: 56rem)": { gridTemplateColumns: "minmax(0, 1fr) 24rem" },
					}),
				]}
			>
				<input type="hidden" name="checkin" value={start} />
				<input type="hidden" name="checkout" value={end} />
				<input type="hidden" name="adults" value={String(search.adults)} />
				<input type="hidden" name="children" value={String(search.children)} />
				<div>
					<Part id="trip" title="Your trip">
						<dl mix={[raw({ display: "grid", gap: "1rem", margin: "0" })]}>
							{[
								{
									term: "Dates",
									detail: `${formatDay(start, { weekday: true })} – ${formatDay(end, { weekday: true, year: true })}`,
								},
								{ term: "Guests", detail: partyLabel(search) },
							].map((row) => (
								<div
									mix={[
										raw({
											display: "flex",
											justifyContent: "space-between",
											alignItems: "start",
											gap: "1rem",
										}),
									]}
								>
									<div>
										<dt mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}>
											{row.term}
										</dt>
										<dd mix={[raw({ margin: "0", color: "var(--ui-neutral-fg)" })]}>
											{row.detail}
										</dd>
									</div>
									<a
										href={back}
										mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}
										aria-label={`Edit ${row.term.toLowerCase()}`}
									>
										Edit
									</a>
								</div>
							))}
						</dl>
					</Part>
					<Part id="pay" title="Pay with">
						<p
							mix={[
								raw({
									display: "flex",
									gap: "0.5rem",
									alignItems: "start",
									margin: "0 0 1rem",
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							<ShieldCheckIcon aria-hidden="true" size={18} mix={[raw({ flexShrink: "0" })]} />
							These saved cards are part of the demo. They are invented, and booking charges
							nothing.
						</p>
						<fieldset
							mix={[raw({ margin: "0", padding: "0", border: "0" })]}
							aria-describedby={cardProblem === undefined ? undefined : "card-problem"}
						>
							<legend
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
								Saved cards
							</legend>
							<div mix={[raw({ display: "grid", gap: "0.75rem" })]}>
								{SAVED_CARDS.map((card) => (
									<label
										mix={[
											raw({
												display: "flex",
												alignItems: "center",
												gap: "1rem",
												padding: "0.875rem 1rem",
												border: "1px solid var(--ui-neutral-border)",
												borderRadius: "var(--ui-radius-lg)",
												cursor: "pointer",
												"&:has(:checked)": {
													borderColor: "var(--ui-neutral-fg-emphasis)",
													boxShadow: "inset 0 0 0 1px var(--ui-neutral-fg-emphasis)",
												},
												"&:has(:focus-visible)": {
													outline: "2px solid var(--ui-brand-ring)",
													outlineOffset: "2px",
												},
											}),
										]}
									>
										<CardFace card={card} />
										<span mix={[raw({ flex: "1 1 auto", display: "grid" })]}>
											<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
												{card.brand} ending in {card.last4}
											</strong>
											<span
												mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
											>
												Expires {card.expires}
											</span>
										</span>
										<input
											type="radio"
											name="card"
											value={card.id}
											checked={card.id === chosen}
											required
											mix={[
												raw({
													inlineSize: "1.25rem",
													blockSize: "1.25rem",
													accentColor: "var(--ui-brand-bg-solid)",
												}),
											]}
										/>
									</label>
								))}
							</div>
						</fieldset>
						{cardProblem === undefined ? null : (
							<p
								id="card-problem"
								role="alert"
								mix={[raw({ margin: "0.75rem 0 0", color: "var(--ui-danger-fg)" })]}
							>
								{cardProblem}
							</p>
						)}
					</Part>
					<Part id="note" title={`Say hello to ${hostName}`}>
						<label
							htmlFor="message"
							mix={[
								raw({
									display: "block",
									marginBlockEnd: "0.5rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Who's coming and what brings you. Optional.
						</label>
						<textarea
							id="message"
							name="message"
							rows={4}
							maxLength={500}
							defaultValue={message}
							mix={[
								raw({
									inlineSize: "100%",
									boxSizing: "border-box",
									padding: "0.75rem 1rem",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-lg)",
									background: "var(--ui-bg)",
									color: "var(--ui-neutral-fg-emphasis)",
									font: "inherit",
									resize: "vertical",
								}),
								when(
									"&:focus",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "0" }),
								),
							]}
						/>
					</Part>
					<Part id="policy" title="Cancellation">
						<p mix={[raw({ margin: "0", lineHeight: "1.55" })]}>
							<strong>Free cancellation before {formatDay(refundBy, { year: true })}.</strong> After
							that, the first night and the service fee are kept.
						</p>
					</Part>
					<button
						type="submit"
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "0.5rem",
								inlineSize: "100%",
								blockSize: "3.5rem",
								border: "0",
								borderRadius: "var(--ui-radius-lg)",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-brand-fg-on-solid)",
								font: "inherit",
								fontSize: "1.0625rem",
								fontWeight: "650",
								cursor: "pointer",
								[`@media ${WIDE}`]: { inlineSize: "auto", paddingInline: "2.5rem" },
							}),
							when("&:hover", raw({ backgroundColor: "var(--ui-brand-bg-solid-hover)" })),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
							),
						]}
					>
						<LockIcon aria-hidden="true" size={18} />
						Confirm and pay {money(price.total)}
					</button>
				</div>
				<aside
					aria-label="Price summary"
					mix={[
						raw({
							display: "grid",
							gap: "1.25rem",
							padding: "1.5rem",
							borderRadius: "1rem",
							boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							"@media (min-width: 56rem)": {
								position: "sticky",
								insetBlockStart: "6rem",
								gridRow: "1",
								gridColumn: "2",
							},
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "7rem minmax(0, 1fr)",
								gap: "1rem",
								alignItems: "center",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "block",
									aspectRatio: "1",
									overflow: "clip",
									borderRadius: "0.75rem",
								}),
							]}
						>
							<StayPhoto stay={stay} eager />
						</span>
						<span mix={[raw({ display: "grid", gap: "0.25rem" })]}>
							<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>{stay.name}</strong>
							<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
								{typeLabel(stay.type)} in {placeOf(stay).name}
							</span>
							<Rating rating={stay.rating} reviews={stay.reviews} compact />
						</span>
					</div>
					<PriceBreakdown
						note={`Charged on ${formatDay(addDays(start, -3), { year: true })} in the demo's make-believe.`}
					>
						{price.lines.map((line) => (
							<PriceBreakdown.Line
								label={line.key === "nights" ? (line.detail ?? line.label) : line.label}
								amount={money(Math.abs(line.cents))}
								tone={line.key === "discount" ? "discount" : undefined}
								line={line.key}
							/>
						))}
						<PriceBreakdown.Total label="Total (USD)" amount={money(price.total)} />
					</PriceBreakdown>
				</aside>
			</form>
		);
	};
}
