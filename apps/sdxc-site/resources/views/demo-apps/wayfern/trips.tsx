/**
 * The traveller's trips as one itinerary: every stay, flight and car booked, gathered into
 * journeys on a day-by-day timeline that exports to calendars; and one booking's page with its
 * boarding passes, rental or stay details, the price paid and a cancel that offers Undo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CalendarCheckIcon,
	CalendarPlusIcon,
	CalendarXIcon,
	ChevronLeftIcon,
	CircleCheckIcon,
	KeyRoundIcon,
	LuggageIcon,
} from "@sdxc/icons";
import { stringify } from "@sdxc/jscalendar";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Badge, Dialog, HeadingScope } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { BoardingPass } from "@sdxc/ui/travel/boarding-pass";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";
import { TripTimeline } from "@sdxc/ui/travel/trip-timeline";

import { demoAppActionHref } from "~/resources/views/demo-apps";

import type { Journey } from "./itinerary";
import type { Quote } from "./pricing";
import type { Screen } from "./screen";
import type { CarTrip, FlightTrip, StayTrip, Trip } from "./state";

import { CarArt } from "./car-art";
import { findCarOffer, findRentalPlace } from "./cars";
import { actionHref, findCard, findStay, hashOf, hostOf, href, placeOf } from "./data";
import { formatDay, formatRange, nightsBetween } from "./days";
import { FARE_CLASSES, cabinOf, findAirline, findAirport, findFlight, localTime } from "./flights";
import { AirlineMark } from "./flights-view";
import { COAST_ZONE, itemsOf, journeysOf, toGroup } from "./itinerary";
import { WIDE } from "./layout";
import { HostFace, Page, StayPhoto, Title } from "./parts";
import { money, quote } from "./pricing";
import { partyLabel } from "./query";
import { carQuote, flightQuote, seatFee } from "./travel-pricing";

/** The words each kind of booking is read as on the timeline. */
const KIND_LABELS = { flight: "Flight", stay: "Stay", car: "Car" };

/** Where a booking stands relative to now. */
export function tripState(trip: Trip, now: number): "upcoming" | "now" | "past" | "cancelled" {
	if (trip.status === "cancelled") return "cancelled";
	let items = itemsOf(trip);
	let starts = Math.min(...items.map((item) => item.starts));
	let ends = Math.max(...items.map((item) => item.ends));
	if (ends <= now) return "past";
	return starts <= now ? "now" : "upcoming";
}

/** A booking's name, as its page and the past list title it. */
export function bookingTitle(trip: Trip): string {
	if (trip.kind === "stay") return findStay(trip.stay)?.name ?? "Stay";
	if (trip.kind === "car")
		return `${findCarOffer(trip.place, trip.offer)?.company.name ?? "Rental"} car`;
	let first = findFlight(trip.legs[0]!.option)!;
	let from = findAirport(first.segments[0]!.from)!.city;
	let to = findAirport(first.segments.at(-1)!.to)!.city;
	return trip.legs.length > 1 ? `Flights ${from} ⇄ ${to}` : `Flight ${from} → ${to}`;
}

/** The ".ics" address of a journey or one booking. */
function icsHref(kind: "journey" | "booking", id: string): string {
	return href(`files/${kind}/${id}.ics`);
}

/** A small bordered pill, for the calendar actions. */
function pillLink() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			minBlockSize: "2.5rem",
			paddingInline: "0.875rem",
			border: "1px solid var(--ui-neutral-border)",
			borderRadius: "999px",
			background: "var(--ui-bg)",
			color: "var(--ui-neutral-fg-emphasis)",
			font: "inherit",
			fontSize: "0.875rem",
			fontWeight: "600",
			textDecoration: "none",
			cursor: "pointer",
		}),
		when("&:hover", raw({ borderColor: "var(--ui-neutral-fg-muted)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}

/** The buttons that put a journey in a calendar: an `.ics` download and an import into Sundial. */
function CalendarActions(handle: Handle<{ journey: Journey }>) {
	return () => {
		let { journey } = handle.props;
		let group = toGroup({
			...journey,
			items: journey.items.filter((item) => item.status === "confirmed"),
		});
		return (
			<div mix={[raw({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })]}>
				<a
					href={icsHref("journey", journey.id)}
					download={`wayfern-${journey.id}.ics`}
					mix={pillLink()}
				>
					<CalendarPlusIcon aria-hidden="true" size={16} />
					Add to calendar (.ics)
				</a>
				<form
					method="post"
					action={demoAppActionHref("sundial")("import")}
					data-rmx-document=""
					mix={[raw({ display: "contents" })]}
				>
					<input type="hidden" name="group" value={stringify(group)} />
					<input type="hidden" name="source" value={`Wayfern trip to ${journey.title}`} />
					<button type="submit" mix={pillLink()}>
						<CalendarCheckIcon aria-hidden="true" size={16} />
						Open in Sundial
					</button>
				</form>
			</div>
		);
	};
}

/** One journey as a timeline: a heading per local day, its items in time order. */
function JourneyTimeline(handle: Handle<{ journey: Journey }>) {
	return () => {
		let { journey } = handle.props;
		let days = new Map<string, RemixNode[]>();
		let push = (day: string, node: RemixNode) => days.set(day, [...(days.get(day) ?? []), node]);
		for (let item of journey.items) {
			let start = localTime(item.starts, item.startZone);
			let end = localTime(item.ends, item.endZone);
			let status =
				item.status === "cancelled" ? <Badge color="danger">Cancelled</Badge> : undefined;
			let details = (
				<a
					href={href(`trips/${item.trip}`)}
					mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}
				>
					Details
				</a>
			);
			let name = item.title.replace("Stay at ", "");
			if (item.kind === "flight") {
				push(
					start.day,
					<TripTimeline.Item
						kind="flight"
						time={start.time}
						dateTime={new Date(item.starts).toISOString()}
						title={item.title}
						details={[`${item.from} → ${item.to} · lands ${end.time} local`, item.detail]}
						status={status}
						actions={details}
					/>,
				);
				continue;
			}
			let [opening, closing] =
				item.kind === "stay" ? ["Check in", "Check out"] : ["Pick up", "Return"];
			push(
				start.day,
				<TripTimeline.Item
					kind={item.kind}
					time={start.time}
					dateTime={new Date(item.starts).toISOString()}
					title={`${opening} · ${name}`}
					details={[item.from, item.detail]}
					status={status}
					actions={details}
				/>,
			);
			push(
				end.day,
				<TripTimeline.Item
					kind={item.kind}
					time={end.time}
					dateTime={new Date(item.ends).toISOString()}
					title={`${closing} · ${name}`}
					details={[item.to ?? item.from]}
					status={status}
				/>,
			);
		}
		let ordered = [...days].sort(([a], [b]) => a.localeCompare(b));
		let first = ordered[0]?.[0] ?? "";
		return (
			<TripTimeline aria-label={`Trip to ${journey.title}`} kindLabels={KIND_LABELS} level={3}>
				{ordered.map(([day, nodes]) => (
					<TripTimeline.Day
						heading={formatDay(day, { weekday: true })}
						date={day}
						detail={`Day ${nightsBetween(first, day) + 1}`}
					>
						{nodes}
					</TripTimeline.Day>
				))}
			</TripTimeline>
		);
	};
}

/** The days a journey spans, read on the coast's clock, for its eyebrow. */
function journeyDates(journey: Journey): string {
	return formatRange(
		localTime(journey.starts, journey.items[0]!.startZone).day,
		localTime(journey.ends, COAST_ZONE).day,
	);
}

/** The trips screen: each upcoming journey's timeline, then everything past or cancelled. */
export default function Trips(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let { traveller } = handle.props.ctx;
		let now = Date.now();
		let journeys = journeysOf(traveller);
		let upcoming = journeys.filter(
			(journey) => journey.ends > now && journey.items.some((item) => item.status === "confirmed"),
		);
		let rest = journeys.filter((journey) => !upcoming.includes(journey)).reverse();
		let pastCodes = [...new Set(rest.flatMap((journey) => journey.items.map((item) => item.trip)))];
		let cancelled = traveller.trips.filter(
			(trip) => trip.status === "cancelled" && !pastCodes.includes(trip.id),
		);
		let older = [
			...pastCodes.map((code) => traveller.trips.find((trip) => trip.id === code)!),
			...cancelled,
		];
		return (
			<Page>
				<Title>Trips</Title>
				{upcoming.length === 0 ? (
					<div mix={[raw({ marginBlockStart: "2rem" })]}>
						<HeadingScope level={2}>
							<Empty kind="first-run" icon={<LuggageIcon />}>
								<Empty.Title>No trips booked yet</Empty.Title>
								<Empty.Description>
									Book a stay, a flight or a car and it shows here, on one timeline with everything
									else you booked.
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
				) : null}
				{upcoming.map((journey) => (
					<section
						aria-labelledby={`journey-${journey.id}`}
						mix={[
							raw({
								marginBlockStart: "2rem",
								padding: "clamp(1rem, 3vw, 1.75rem)",
								borderRadius: "1.25rem",
								boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						<div
							mix={[
								raw({
									display: "flex",
									justifyContent: "space-between",
									alignItems: "start",
									gap: "1rem",
									flexWrap: "wrap",
									marginBlockEnd: "1.25rem",
								}),
							]}
						>
							<div>
								<p
									mix={[
										raw({
											margin: "0",
											fontSize: "0.875rem",
											fontWeight: "650",
											color: "var(--ui-brand-fg)",
										}),
									]}
								>
									{journeyDates(journey)}
								</p>
								<h2
									id={`journey-${journey.id}`}
									mix={[
										raw({
											margin: "0",
											fontFamily: "var(--ui-font-serif)",
											fontSize: "1.75rem",
											fontWeight: "600",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									Trip to {journey.title}
								</h2>
							</div>
							<CalendarActions journey={journey} />
						</div>
						<JourneyTimeline journey={journey} />
					</section>
				))}
				{older.length === 0 ? null : (
					<section aria-labelledby="journeys-past" mix={[raw({ marginBlockStart: "2.5rem" })]}>
						<h2
							id="journeys-past"
							mix={[
								raw({
									margin: "0 0 1rem",
									fontSize: "1.25rem",
									fontWeight: "650",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							Past and cancelled
						</h2>
						<ul
							mix={[
								raw({
									display: "grid",
									gap: "0.75rem",
									margin: "0",
									padding: "0",
									listStyle: "none",
								}),
							]}
						>
							{older.map((trip) => (
								<li>
									<a
										href={href(`trips/${trip.id}`)}
										mix={[
											raw({
												display: "flex",
												justifyContent: "space-between",
												gap: "1rem",
												padding: "1rem 1.25rem",
												borderRadius: "1rem",
												boxShadow: "0 0 0 1px var(--ui-neutral-border)",
												color: "inherit",
												textDecoration: "none",
											}),
											when("&:hover", raw({ boxShadow: "0 0 0 1px var(--ui-neutral-fg-muted)" })),
										]}
									>
										<span>
											<strong>{bookingTitle(trip)}</strong> · {trip.id}
										</span>
										<span
											mix={[
												raw({
													color:
														trip.status === "cancelled"
															? "var(--ui-danger-fg)"
															: "var(--ui-neutral-fg-muted)",
												}),
											]}
										>
											{trip.status === "cancelled" ? "Cancelled" : "Taken"}
										</span>
									</a>
								</li>
							))}
						</ul>
					</section>
				)}
			</Page>
		);
	};
}

/** A label and value on a booking page, with an icon. */
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

/** The dialog asking to confirm a cancellation. */
const CANCEL_DIALOG = "wayfern-cancel";

/** What a booking cost, as its receipt prints it. */
export function priceOf(trip: Trip): Quote {
	if (trip.kind === "stay") return quote(findStay(trip.stay)!, trip.start, trip.end);
	if (trip.kind === "car") {
		let item = itemsOf(trip)[0]!;
		return carQuote(
			findCarOffer(trip.place, trip.offer)!,
			item.starts,
			item.ends,
			trip.extras,
			trip.dropoff !== trip.place,
		);
	}
	return flightQuote(
		trip.legs.map((leg) => {
			let option = findFlight(leg.option)!;
			let fees = option.segments.reduce((sum, segment, index) => {
				let seat = cabinOf(segment)
					.rows.flatMap((row) => row.seats)
					.find((entry) => entry.id === leg.seats[index]);
				return (
					sum +
					(seat === undefined ? 0 : seatFee(leg.fare, seat.price) * (trip.adults + trip.children))
				);
			}, 0);
			return { option, fare: leg.fare, seatFees: fees };
		}),
		trip.adults,
		trip.children,
	);
}

/** The labels every boarding pass shows. */
function passLabels(code: string) {
	return {
		passenger: "Passenger",
		flight: "Flight",
		date: "Date",
		gate: "Gate",
		boards: "Boards",
		seat: "Seat",
		zone: "Zone",
		cabin: "Fare",
		confirmation: "Confirmation",
		from: "From",
		to: "To",
		code: `Boarding code for confirmation ${code}`,
	};
}

/** A flight booking's boarding passes: one per segment, for the lead passenger. */
function BoardingPasses(handle: Handle<{ trip: FlightTrip }>) {
	return () => {
		let { trip } = handle.props;
		let passes: RemixNode[] = [];
		for (let leg of trip.legs) {
			let option = findFlight(leg.option)!;
			option.segments.forEach((segment, index) => {
				let from = findAirport(segment.from)!;
				let to = findAirport(segment.to)!;
				let seed = hashOf(`${trip.id}${segment.flight}`);
				let seat = leg.seats[index] ?? "—";
				passes.push(
					<BoardingPass
						label={`Boarding pass for ${segment.flight}`}
						airline={{
							name: findAirline(segment.airline)?.name ?? segment.airline,
							mark: <AirlineMark code={segment.airline} size={1.75} />,
						}}
						passenger={trip.lead.toUpperCase()}
						from={{
							code: from.code,
							city: from.city,
							time: localTime(segment.departs, from.timeZone).time,
						}}
						to={{
							code: to.code,
							city: to.city,
							time: localTime(segment.arrives, to.timeZone).time,
						}}
						flight={segment.flight}
						date={formatDay(localTime(segment.departs, from.timeZone).day, { weekday: true })}
						gate={`${"ABC"[seed % 3]}${(seed >>> 3) % 40}`}
						boards={localTime(segment.departs - 40 * 60_000, from.timeZone).time}
						seat={seat}
						zone={String(1 + ((seed >>> 7) % 5))}
						cabin={FARE_CLASSES.find((fare) => fare.id === leg.fare)?.name ?? "Standard"}
						confirmation={trip.id}
						code={`${trip.id}-${segment.flight}-${seat}`}
						labels={passLabels(trip.id)}
					/>,
				);
			});
		}
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 19rem), 1fr))",
						gap: "1.25rem",
					}),
				]}
			>
				{passes}
			</div>
		);
	};
}

/** A stay booking's dates, code, party and host. */
function StayDetails(handle: Handle<{ trip: StayTrip }>) {
	return () => {
		let { trip } = handle.props;
		let stay = findStay(trip.stay)!;
		let host = hostOf(stay);
		return (
			<div mix={[raw({ display: "grid", gap: "1.5rem" })]}>
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
						<span mix={[raw({ fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em" })]}>
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
						<strong>Your host, {host.name}</strong>
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							Responds {host.responds}. The address and door code arrive two days before you do.
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
		);
	};
}

/** A car booking's pickup, return, code and car. */
function CarDetails(handle: Handle<{ trip: CarTrip }>) {
	return () => {
		let { trip } = handle.props;
		let offer = findCarOffer(trip.place, trip.offer)!;
		return (
			<div mix={[raw({ display: "grid", gap: "1.5rem" })]}>
				<div mix={[raw({ maxInlineSize: "20rem" })]}>
					<CarArt car={offer.car} />
				</div>
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
					<Fact icon={<CalendarCheckIcon size={20} />} term="Pick up">
						{findRentalPlace(trip.place)?.name},{" "}
						{formatDay(trip.pickupAt.slice(0, 10), { weekday: true })} at {trip.pickupAt.slice(11)}
					</Fact>
					<Fact icon={<CalendarXIcon size={20} />} term="Return">
						{findRentalPlace(trip.dropoff)?.name},{" "}
						{formatDay(trip.dropoffAt.slice(0, 10), { weekday: true })} by{" "}
						{trip.dropoffAt.slice(11)}
					</Fact>
					<Fact icon={<KeyRoundIcon size={20} />} term="Confirmation code">
						<span mix={[raw({ fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em" })]}>
							{trip.id}
						</span>
					</Fact>
					<Fact icon={<LuggageIcon size={20} />} term="Car">
						{offer.car.name} · {offer.car.model} or similar
					</Fact>
				</dl>
			</div>
		);
	};
}

/** The confirmation's headline status, celebrating a booking made a moment ago. */
function heroLabel(state: ReturnType<typeof tripState>, fresh: boolean): string {
	if (state === "cancelled") return "Cancelled";
	if (fresh) return "Booked. You're going!";
	if (state === "past") return "Taken";
	return "Confirmed";
}

/**
 * One booking's page: a hero for its kind, its details (boarding passes for a flight), what was
 * paid and with which card, an `.ics` of it, and a cancel that confirms in a native dialog.
 */
export function TripPage(handle: Handle<{ ctx: Screen; trip: Trip }>) {
	return () => {
		let { ctx, trip } = handle.props;
		let card = findCard(trip.card)!;
		let price = priceOf(trip);
		let now = Date.now();
		let state = tripState(trip, now);
		let starts = Math.min(...itemsOf(trip).map((item) => item.starts));
		let refundable = state === "upcoming" && starts - now >= 7 * 86_400_000;
		let fresh = ctx.url.searchParams.get("toast")?.startsWith("booked") === true;
		let stay = trip.kind === "stay" ? findStay(trip.stay) : undefined;
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
							background:
								"linear-gradient(135deg, var(--ui-color-brand-700), var(--ui-color-brand-500))",
						}),
					]}
				>
					{stay === undefined ? null : <StayPhoto stay={stay} kind="view" eager />}
					<div
						mix={[
							raw({
								position: "absolute",
								inset: "0",
								display: "grid",
								alignContent: "end",
								gap: "0.25rem",
								padding: "clamp(1rem, 3vw, 2rem)",
								background: "linear-gradient(to top, rgb(0 0 0 / 0.6), transparent 70%)",
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
							{stay === undefined ? bookingTitle(trip) : `${stay.name}, ${placeOf(stay).name}`}
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
					<div mix={[raw({ display: "grid", gap: "1.5rem", alignContent: "start" })]}>
						{trip.kind === "flight" ? <BoardingPasses trip={trip} /> : null}
						{trip.kind === "stay" ? <StayDetails trip={trip} /> : null}
						{trip.kind === "car" ? <CarDetails trip={trip} /> : null}
						<a
							href={icsHref("booking", trip.id)}
							download={`wayfern-${trip.id}.ics`}
							mix={[...pillLink(), raw({ justifySelf: "start" })]}
						>
							<CalendarPlusIcon aria-hidden="true" size={16} />
							Add to calendar (.ics)
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
									Cancel this booking
								</button>
								<HeadingScope level={2}>
									<Dialog id={CANCEL_DIALOG} aria-labelledby={`${CANCEL_DIALOG}-title`}>
										<Dialog.Header>
											<Dialog.Title id={`${CANCEL_DIALOG}-title`}>
												Cancel {bookingTitle(trip)}?
											</Dialog.Title>
											<Dialog.Description>
												{refundable
													? `You get ${money(price.total)} back, the whole amount.`
													: "It's within a week, so part of the price is kept."}
											</Dialog.Description>
										</Dialog.Header>
										<Dialog.Footer>
											<button
												type="button"
												commandfor={CANCEL_DIALOG}
												command="close"
												mix={quietButton()}
											>
												Keep it
											</button>
											<form
												method="post"
												action={actionHref(`trips/${trip.id}/cancel`)}
												mix={[raw({ display: "contents" })]}
											>
												<button type="submit" mix={dangerButton()}>
													Cancel booking
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
