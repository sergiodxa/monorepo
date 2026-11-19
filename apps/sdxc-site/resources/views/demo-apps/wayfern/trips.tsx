/**
 * The traveller's trips: what is coming up, what is done and what was cancelled, and one
 * trip's confirmation with its code, the host, the price paid and a cancel that offers Undo.
 * A trip is the visitor's own, read from their cookie, so nothing here reaches anyone else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CalendarCheckIcon,
	CalendarXIcon,
	ChevronLeftIcon,
	CircleCheckIcon,
	KeyRoundIcon,
	LuggageIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Dialog, HeadingScope } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";

import type { Screen } from "./screen";
import type { Trip } from "./state";

import { actionHref, findCard, findStay, hostOf, href, placeOf } from "./data";
import { addDays, formatDay, formatRange, nightsBetween } from "./days";
import { WIDE } from "./layout";
import { HostFace, Page, StayPhoto, Title } from "./parts";
import { money, quote } from "./pricing";
import { partyLabel } from "./query";

/** Where a trip stands relative to today. */
function tripState(trip: Trip, today: string): "upcoming" | "now" | "past" | "cancelled" {
	if (trip.status === "cancelled") return "cancelled";
	if (trip.end <= today) return "past";
	if (trip.start <= today) return "now";
	return "upcoming";
}

/** The word a trip row leads with: how soon, now, done or cancelled. */
function stateLabel(state: ReturnType<typeof tripState>, until: number): string {
	if (state === "upcoming") return until === 1 ? "Tomorrow" : `In ${until} days`;
	if (state === "now") return "Happening now";
	if (state === "past") return "Stayed";
	return "Cancelled";
}

/** The confirmation's headline status, celebrating a trip booked a moment ago. */
function heroLabel(state: ReturnType<typeof tripState>, fresh: boolean): string {
	if (state === "cancelled") return "Cancelled";
	if (fresh) return "Booked. You're going!";
	if (state === "past") return "Stayed";
	return "Confirmed";
}

/** One trip as a row: photo, place, dates and where it stands, linking to its confirmation. */
function TripRow(handle: Handle<{ trip: Trip; today: string }>) {
	return () => {
		let { today, trip } = handle.props;
		let stay = findStay(trip.stay)!;
		let state = tripState(trip, today);
		let until = nightsBetween(today, trip.start);
		return (
			<li>
				<a
					href={href(`trips/${trip.id}`)}
					data-rmx-prefetch="intent"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "6rem minmax(0, 1fr)",
							gap: "1rem",
							alignItems: "center",
							padding: "0.75rem",
							borderRadius: "1rem",
							color: "inherit",
							textDecoration: "none",
							boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							opacity: state === "cancelled" ? "0.7" : "1",
							[`@media ${WIDE}`]: { gridTemplateColumns: "9rem minmax(0, 1fr)" },
						}),
						when(
							"&:hover",
							raw({
								boxShadow:
									"0 0 0 1px var(--ui-neutral-fg-muted), 0 8px 20px -12px rgb(0 0 0 / 0.3)",
							}),
						),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
						),
					]}
				>
					<span
						mix={[
							raw({
								display: "block",
								aspectRatio: "4 / 3",
								overflow: "clip",
								borderRadius: "0.75rem",
							}),
						]}
					>
						<StayPhoto stay={stay} />
					</span>
					<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
						<span
							mix={[
								raw({
									fontSize: "0.8125rem",
									fontWeight: "650",
									color: state === "cancelled" ? "var(--ui-danger-fg)" : "var(--ui-brand-fg)",
								}),
							]}
						>
							{stateLabel(state, until)}
						</span>
						<strong mix={[raw({ fontSize: "1.0625rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
							{placeOf(stay).name}
						</strong>
						<span mix={[raw({ color: "var(--ui-neutral-fg)" })]}>{stay.name}</span>
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{formatRange(trip.start, trip.end)} · {trip.id}
						</span>
					</span>
				</a>
			</li>
		);
	};
}

/** A titled group of trips, or nothing when it is empty. */
function TripGroup(handle: Handle<{ title: string; trips: Trip[]; today: string }>) {
	return () => {
		let { title, today, trips } = handle.props;
		if (trips.length === 0) return null;
		return (
			<section aria-label={title} mix={[raw({ marginBlockStart: "2rem" })]}>
				<h2
					mix={[
						raw({
							margin: "0 0 1rem",
							fontSize: "1.25rem",
							fontWeight: "650",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{title}
				</h2>
				<ul
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 24rem), 1fr))",
							gap: "1rem",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
					]}
				>
					{trips.map((trip) => (
						<TripRow trip={trip} today={today} />
					))}
				</ul>
			</section>
		);
	};
}

/** The trips screen. */
export default function Trips(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let { today, traveller } = handle.props.ctx;
		let upcoming = traveller.trips
			.filter((trip) => ["upcoming", "now"].includes(tripState(trip, today)))
			.sort((a, b) => a.start.localeCompare(b.start));
		let past = traveller.trips.filter((trip) => tripState(trip, today) === "past");
		let cancelled = traveller.trips.filter((trip) => trip.status === "cancelled");
		return (
			<Page>
				<Title>Trips</Title>
				{upcoming.length === 0 ? (
					<div mix={[raw({ marginBlockStart: "2rem" })]}>
						<HeadingScope level={2}>
							<Empty kind="first-run" icon={<LuggageIcon />}>
								<Empty.Title>No trips booked yet</Empty.Title>
								<Empty.Description>
									When you book a stay, it shows here with everything you need for the day you
									arrive.
								</Empty.Description>
								<Empty.Action>
									<a
										href={href()}
										mix={[raw({ fontWeight: "650", color: "var(--ui-brand-fg-emphasis)" })]}
									>
										Start searching
									</a>
								</Empty.Action>
							</Empty>
						</HeadingScope>
					</div>
				) : (
					<TripGroup title="Coming up" trips={upcoming} today={today} />
				)}
				<TripGroup title="Where you've been" trips={past} today={today} />
				<TripGroup title="Cancelled" trips={cancelled} today={today} />
			</Page>
		);
	};
}

/** A label and value on the confirmation, with an icon. */
function Fact(handle: Handle<{ icon: RemixNode; term: string; children: RemixNode }>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "auto 1fr",
					gap: "0 0.875rem",
					alignItems: "start",
				}),
			]}
		>
			<span mix={[raw({ gridRow: "span 2", color: "var(--ui-neutral-fg-emphasis)" })]}>
				{handle.props.icon}
			</span>
			<dt mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
				{handle.props.term}
			</dt>
			<dd mix={[raw({ margin: "0", fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
				{handle.props.children}
			</dd>
		</div>
	);
}

/** The dialog asking to confirm a cancellation, which names what is refunded. */
const CANCEL_DIALOG = "wayfern-cancel";

/**
 * One trip's confirmation: a hero on the stay's photo, the code, the dates and check-in, the
 * host, what was paid and with which card, and a cancel that confirms in a native dialog.
 */
export function TripPage(handle: Handle<{ ctx: Screen; trip: Trip }>) {
	return () => {
		let { ctx, trip } = handle.props;
		let stay = findStay(trip.stay)!;
		let host = hostOf(stay);
		let card = findCard(trip.card)!;
		let price = quote(stay, trip.start, trip.end);
		let state = tripState(trip, ctx.today);
		let refundable = state === "upcoming" && nightsBetween(ctx.today, trip.start) >= 7;
		let fresh = ctx.url.searchParams.get("toast")?.startsWith("booked") === true;
		return (
			<Page narrow>
				<a
					href={href("trips")}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							minBlockSize: "2.75rem",
							marginBlockEnd: "0.75rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
						}),
						when("&:hover", raw({ textDecoration: "underline" })),
					]}
				>
					<ChevronLeftIcon aria-hidden="true" size={18} />
					All trips
				</a>
				<div
					mix={[
						raw({
							position: "relative",
							overflow: "clip",
							borderRadius: "1.25rem",
							aspectRatio: "21 / 9",
							minBlockSize: "12rem",
						}),
					]}
				>
					<StayPhoto stay={stay} kind="view" eager />
					<div
						mix={[
							raw({
								position: "absolute",
								inset: "0",
								display: "grid",
								alignContent: "end",
								gap: "0.25rem",
								padding: "clamp(1rem, 3vw, 2rem)",
								background: "linear-gradient(to top, rgb(0 0 0 / 0.65), transparent 70%)",
								color: "white",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									fontWeight: "650",
									fontSize: "0.875rem",
								}),
							]}
						>
							{state === "cancelled" ? (
								<CalendarXIcon aria-hidden="true" size={16} />
							) : (
								<CircleCheckIcon aria-hidden="true" size={16} />
							)}
							{heroLabel(state, fresh)}
						</span>
						<h1
							mix={[
								raw({
									margin: "0",
									fontFamily: "var(--ui-font-serif)",
									fontSize: "clamp(1.75rem, 1.2rem + 2vw, 2.75rem)",
									fontWeight: "600",
									lineHeight: "1.05",
								}),
							]}
						>
							{stay.name}, {placeOf(stay).name}
						</h1>
					</div>
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "2rem",
							marginBlockStart: "2rem",
							gridTemplateColumns: "minmax(0, 1fr)",
							[`@media ${WIDE}`]: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 20rem)" },
						}),
					]}
				>
					<div mix={[raw({ display: "grid", gap: "2rem", alignContent: "start" })]}>
						<dl
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
									gap: "1.25rem",
									margin: "0",
								}),
							]}
						>
							<Fact icon={<CalendarCheckIcon size={20} />} term="Check-in">
								{formatDay(trip.start, { weekday: true, year: true })} after 3pm
							</Fact>
							<Fact icon={<CalendarXIcon size={20} />} term="Check-out">
								{formatDay(trip.end, { weekday: true, year: true })} by 11am
							</Fact>
							<Fact icon={<KeyRoundIcon size={20} />} term="Confirmation code">
								<span
									mix={[raw({ fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em" })]}
								>
									{trip.id}
								</span>
							</Fact>
							<Fact icon={<LuggageIcon size={20} />} term="Who's coming">
								{partyLabel(trip)}
							</Fact>
						</dl>
						<div
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "1rem",
									padding: "1.25rem",
									borderRadius: "1rem",
									boxShadow: "0 0 0 1px var(--ui-neutral-border)",
								}),
							]}
						>
							<HostFace name={host.name} hues={host.hues} size={3.5} />
							<div mix={[raw({ display: "grid", gap: "0.125rem" })]}>
								<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
									Your host, {host.name}
								</strong>
								<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
									Responds {host.responds}. The address and door code arrive{" "}
									{formatDay(addDays(trip.start, -2))}.
								</span>
							</div>
						</div>
						<a
							href={href(`stay/${stay.id}`)}
							mix={[
								raw({
									justifySelf: "start",
									fontWeight: "650",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							View the listing
						</a>
					</div>
					<aside
						aria-label="What you paid"
						mix={[
							raw({
								display: "grid",
								gap: "1.25rem",
								alignContent: "start",
								padding: "1.5rem",
								borderRadius: "1rem",
								boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						<PriceBreakdown
							note={`${card.brand} ending in ${card.last4} · a demo card, nothing was charged`}
						>
							{price.lines.map((line) => (
								<PriceBreakdown.Line
									label={line.key === "nights" ? (line.detail ?? line.label) : line.label}
									amount={money(Math.abs(line.cents))}
									tone={line.key === "discount" ? "discount" : undefined}
									line={line.key}
								/>
							))}
							<PriceBreakdown.Total
								label={trip.status === "cancelled" ? "Refunded" : "Paid"}
								amount={money(price.total)}
							/>
						</PriceBreakdown>
						{state === "upcoming" ? (
							<>
								<button
									type="button"
									commandfor={CANCEL_DIALOG}
									command="show-modal"
									mix={dangerLink()}
								>
									Cancel this trip
								</button>
								<HeadingScope level={2}>
									<Dialog id={CANCEL_DIALOG} aria-labelledby={`${CANCEL_DIALOG}-title`}>
										<Dialog.Header>
											<Dialog.Title id={`${CANCEL_DIALOG}-title`}>
												Cancel your stay at {stay.name}?
											</Dialog.Title>
											<Dialog.Description>
												{refundable
													? `You get ${money(price.total)} back, the whole amount. ${host.name.split(" ")[0]} is told straight away.`
													: `It's within a week of check-in, so the first night and the service fee are kept.`}
											</Dialog.Description>
										</Dialog.Header>
										<Dialog.Footer>
											<button
												type="button"
												commandfor={CANCEL_DIALOG}
												command="close"
												mix={quietButton()}
											>
												Keep my trip
											</button>
											<form
												method="post"
												action={actionHref(`trips/${trip.id}/cancel`)}
												mix={[raw({ display: "contents" })]}
											>
												<button type="submit" mix={dangerButton()}>
													Cancel trip
												</button>
											</form>
										</Dialog.Footer>
									</Dialog>
								</HeadingScope>
							</>
						) : null}
					</aside>
				</div>
			</Page>
		);
	};
}

/** The cancel trigger: quiet, underlined, in the danger colour. */
function dangerLink() {
	return [
		raw({
			justifySelf: "start",
			padding: "0",
			minBlockSize: "2.75rem",
			border: "0",
			background: "transparent",
			color: "var(--ui-danger-fg)",
			font: "inherit",
			fontWeight: "600",
			textDecoration: "underline",
			cursor: "pointer",
		}),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}

/** The dialog's confirming button, solid in the danger colour. */
function dangerButton() {
	return [
		raw({
			blockSize: "2.75rem",
			paddingInline: "1.25rem",
			border: "0",
			borderRadius: "var(--ui-radius-md)",
			backgroundColor: "var(--ui-danger-bg-solid)",
			color: "white",
			font: "inherit",
			fontWeight: "650",
			cursor: "pointer",
		}),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}

/** The dialog's dismissing button, bordered and quiet. */
function quietButton() {
	return [
		raw({
			blockSize: "2.75rem",
			paddingInline: "1.25rem",
			border: "1px solid var(--ui-neutral-border)",
			borderRadius: "var(--ui-radius-md)",
			background: "var(--ui-bg)",
			color: "var(--ui-neutral-fg-emphasis)",
			font: "inherit",
			fontWeight: "600",
			cursor: "pointer",
		}),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}
