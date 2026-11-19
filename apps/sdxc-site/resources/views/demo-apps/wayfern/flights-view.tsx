/**
 * Wayfern's flight screens: the search with a strip of nearby days' fares, the results for the
 * leg being chosen with filters in the address, a month of fares for flexible dates, fare
 * classes, a seat map per segment, and the passengers and payment that book it all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CalendarDaysIcon, CheckIcon, ChevronLeftIcon, ShieldCheckIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Badge } from "@sdxc/ui";
import { FareCalendar } from "@sdxc/ui/travel/fare-calendar";
import { FareOptions } from "@sdxc/ui/travel/fare-options";
import { FlightItinerary } from "@sdxc/ui/travel/flight-itinerary";
import { FlightOption } from "@sdxc/ui/travel/flight-option";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";
import { SeatMap } from "@sdxc/ui/travel/seat-map";

import type { FlightSearch, Leg } from "./flight-query";
import type { FlightOption as Option, Segment } from "./flights";
import type { Screen } from "./screen";

import { FLIGHT_PROBLEMS } from "./bookings";
import { SAVED_CARDS, TRAVELLER, actionHref, href } from "./data";
import { addDays, formatDay } from "./days";
import {
	FLIGHT_SORTS,
	WINDOWS,
	currentLeg,
	findFlights,
	readFlightSearch,
	standouts,
	writeFlightSearch,
} from "./flight-query";
import {
	AIRLINES,
	FARE_CLASSES,
	cabinOf,
	cheapestOn,
	daysAround,
	farePrice,
	findAirline,
	findAirport,
	findFlight,
	formatMinutes,
	journeyMinutes,
	localTime,
} from "./flights";
import { GUTTER, SPLIT, TOP_BAR } from "./layout";
import { Page, Title } from "./parts";
import { money } from "./pricing";
import { flightQuote, seatFee } from "./travel-pricing";
import { FlightSearchForm } from "./travel-search";

/** The labels every fare calendar shows. */
const FARE_LABELS = {
	previous: "Previous month",
	next: "Next month",
	cheapest: "cheapest",
	noFlights: "No flights",
};

/** The words a fare option uses for what each fare includes. */
const STATUS_LABELS = { yes: "Included", no: "Not available", fee: "For a fee" };

/** A flights page address for a search. */
function flightsHref(page: string, search: FlightSearch, keepFilters = true): string {
	let query = writeFlightSearch(search, keepFilters);
	return href(query === "" ? page : `${page}?${query}`);
}

/** An airline's tail mark: a rounded square in its hue with its two letters. */
export function AirlineMark(handle: Handle<{ code: string; size?: number }>) {
	return () => {
		let airline = findAirline(handle.props.code);
		let size = handle.props.size ?? 1.75;
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: "0",
						inlineSize: `${size}rem`,
						aspectRatio: "1",
						borderRadius: `${size * 0.28}rem`,
						background: `linear-gradient(135deg, oklch(0.62 0.13 ${airline?.hue ?? 150}), oklch(0.45 0.12 ${(airline?.hue ?? 150) + 25}))`,
						color: "white",
						fontSize: `${size * 0.38}rem`,
						fontWeight: "750",
						letterSpacing: "0.02em",
					}),
				]}
			>
				{handle.props.code}
			</span>
		);
	};
}

/** A local time at an airport, `08:40`. */
function clock(instant: number, airport: string): string {
	return localTime(instant, findAirport(airport)!.timeZone).time;
}

/** "+1" when an arrival lands on a later local day than its journey left. */
function dayOffset(option: Option): string | undefined {
	let first = option.segments[0]!;
	let last = option.segments.at(-1)!;
	let left = localTime(first.departs, findAirport(first.from)!.timeZone).day;
	let landed = localTime(last.arrives, findAirport(last.to)!.timeZone).day;
	let days = Math.round((Date.parse(landed) - Date.parse(left)) / 86_400_000);
	return days > 0 ? `+${days}` : undefined;
}

/** The words for a journey's stops: "Nonstop", "1 stop · KSH". */
function stopsText(option: Option): string {
	let stops = option.segments.length - 1;
	if (stops === 0) return "Nonstop";
	let via = option.segments.slice(0, -1).map((segment) => segment.to);
	return `${stops} ${stops === 1 ? "stop" : "stops"} · ${via.join(", ")}`;
}

/** Every segment of a journey with the layovers between, for an expanded itinerary. */
function Segments(handle: Handle<{ option: Option; cabin?: string }>) {
	return () => {
		let { cabin, option } = handle.props;
		let parts: RemixNode[] = [];
		option.segments.forEach((segment, index) => {
			if (index > 0) {
				let previous = option.segments[index - 1]!;
				let wait = Math.round((segment.departs - previous.arrives) / 60_000);
				let airport = findAirport(segment.from)!;
				parts.push(
					<FlightItinerary.Layover
						tone={wait < 75 || wait > 360 ? "warning" : "default"}
						note={wait < 75 ? "Short connection" : undefined}
					>
						{formatMinutes(wait)} layover in {airport.code} {airport.city}
					</FlightItinerary.Layover>,
				);
			}
			parts.push(<SegmentLine segment={segment} cabin={cabin} />);
		});
		return <>{parts}</>;
	};
}

/** One segment as an itinerary row. */
function SegmentLine(handle: Handle<{ segment: Segment; cabin?: string }>) {
	return () => {
		let { cabin, segment } = handle.props;
		let from = findAirport(segment.from)!;
		let to = findAirport(segment.to)!;
		return (
			<FlightItinerary.Segment
				airline={findAirline(segment.airline)?.name ?? segment.airline}
				mark={<AirlineMark code={segment.airline} size={1.5} />}
				flightNumber={segment.flight}
				aircraft={segment.aircraft}
				cabin={cabin}
				departure={{
					time: clock(segment.departs, from.code),
					code: from.code,
					city: from.city,
					dateTime: new Date(segment.departs).toISOString(),
				}}
				arrival={{
					time: clock(segment.arrives, to.code),
					code: to.code,
					city: to.city,
					dateTime: new Date(segment.arrives).toISOString(),
				}}
				duration={formatMinutes(Math.round((segment.arrives - segment.departs) / 60_000))}
			/>
		);
	};
}

/** A whole journey summarised, expandable to its segments. */
function Journey(
	handle: Handle<{ option: Option; title?: RemixNode; cabin?: string; open?: boolean }>,
) {
	return () => {
		let { cabin, open, option, title } = handle.props;
		let first = option.segments[0]!;
		let last = option.segments.at(-1)!;
		return (
			<FlightItinerary
				title={title}
				airline={findAirline(first.airline)?.name}
				departure={{
					time: clock(first.departs, first.from),
					code: first.from,
					city: findAirport(first.from)!.city,
				}}
				arrival={{
					time: clock(last.arrives, last.to),
					code: last.to,
					city: findAirport(last.to)!.city,
				}}
				duration={formatMinutes(journeyMinutes(option))}
				stops={option.segments.length - 1}
				stopsLabel={stopsText(option)}
				dayOffset={dayOffset(option)}
				dayOffsetLabel="arrives the next day"
				toggleLabel="Flight details"
				open={open}
			>
				<Segments option={option} cabin={cabin} />
			</FlightItinerary>
		);
	};
}

/** A filter link styled as a checkbox row: on when the address has it, toggling it off. */
function FilterLink(handle: Handle<{ href: string; on: boolean; children: RemixNode }>) {
	return () => (
		<a
			href={handle.props.href}
			aria-current={handle.props.on ? "true" : undefined}
			mix={[
				raw({
					display: "flex",
					alignItems: "center",
					gap: "0.625rem",
					minBlockSize: "2.5rem",
					color: "var(--ui-neutral-fg-emphasis)",
					textDecoration: "none",
					"& [data-box]": {
						display: "inline-grid",
						placeItems: "center",
						inlineSize: "1.25rem",
						blockSize: "1.25rem",
						borderRadius: "0.375rem",
						border: "1.5px solid var(--ui-neutral-border-strong, var(--ui-neutral-fg-muted))",
						color: "transparent",
					},
					"&[aria-current] [data-box]": {
						backgroundColor: "var(--ui-brand-bg-solid)",
						borderColor: "var(--ui-brand-bg-solid)",
						color: "var(--ui-brand-fg-on-solid)",
					},
				}),
				when("&:hover", raw({ textDecoration: "underline" })),
				when(
					"&:focus-visible",
					raw({
						outline: "2px solid var(--ui-brand-ring)",
						outlineOffset: "2px",
						borderRadius: "0.375rem",
					}),
				),
			]}
		>
			<span data-box="" aria-hidden="true">
				<CheckIcon size={14} />
			</span>
			{handle.props.children}
		</a>
	);
}

/** A titled group of filters in the side panel. */
function FilterGroup(handle: Handle<{ title: string; children: RemixNode }>) {
	return () => (
		<section
			aria-label={handle.props.title}
			mix={[raw({ paddingBlock: "1rem", borderBlockEnd: "1px solid var(--ui-neutral-border)" })]}
		>
			<h3
				mix={[
					raw({
						margin: "0 0 0.5rem",
						fontSize: "0.9375rem",
						fontWeight: "650",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{handle.props.title}
			</h3>
			{handle.props.children}
		</section>
	);
}

/** Toggles one value in a list. */
function toggle<T>(list: T[], value: T): T[] {
	return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/** The filters for the leg being chosen, every one a link that keeps the rest of the search. */
function Filters(handle: Handle<{ search: FlightSearch }>) {
	return () => {
		let { search } = handle.props;
		let link = (next: Partial<FlightSearch>) => flightsHref("flights", { ...search, ...next });
		return (
			<div>
				<FilterGroup title="Stops">
					{[
						[0, "Nonstop"],
						[1, "1 stop"],
						[2, "2+ stops"],
					].map(([value, label]) => (
						<FilterLink
							href={link({ stops: toggle(search.stops, value as number) })}
							on={search.stops.includes(value as number)}
						>
							{label}
						</FilterLink>
					))}
				</FilterGroup>
				<FilterGroup title="Departure time">
					{WINDOWS.map((window) => (
						<FilterLink
							href={link({ departs: toggle(search.departs, window.id) })}
							on={search.departs.includes(window.id)}
						>
							{window.label}{" "}
							<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" })]}>
								{window.hint}
							</span>
						</FilterLink>
					))}
				</FilterGroup>
				<FilterGroup title="Arrival time">
					{WINDOWS.map((window) => (
						<FilterLink
							href={link({ arrives: toggle(search.arrives, window.id) })}
							on={search.arrives.includes(window.id)}
						>
							{window.label}{" "}
							<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" })]}>
								{window.hint}
							</span>
						</FilterLink>
					))}
				</FilterGroup>
				<FilterGroup title="Airlines">
					{AIRLINES.map((airline) => (
						<FilterLink
							href={link({ airlines: toggle(search.airlines, airline.code) })}
							on={search.airlines.includes(airline.code)}
						>
							<AirlineMark code={airline.code} size={1.25} /> {airline.name}
						</FilterLink>
					))}
				</FilterGroup>
				<FilterGroup title="Journey time">
					{[6, 9, 12].map((hours) => (
						<FilterLink
							href={link({ maxHours: search.maxHours === hours ? undefined : hours })}
							on={search.maxHours === hours}
						>
							Under {hours} hours
						</FilterLink>
					))}
				</FilterGroup>
				<FilterGroup title="Price">
					{[300, 450, 600].map((dollars) => (
						<FilterLink
							href={link({ maxPrice: search.maxPrice === dollars ? undefined : dollars })}
							on={search.maxPrice === dollars}
						>
							Up to {money(dollars * 100)}
						</FilterLink>
					))}
				</FilterGroup>
			</div>
		);
	};
}

/** How a day's cheapest fare compares with its neighbours, for the fare calendar's shading. */
function fareLevel(price: number, low: number): "low" | "mid" | "high" {
	if (price <= low * 1.04) return "low";
	return price > low * 1.25 ? "high" : "mid";
}

/** The fares of a run of days on a route, shaded against the cheapest of them. */
function faresFor(leg: Leg, days: string[], today: string) {
	let prices = new Map(
		days.map((day) => [day, day < today ? undefined : cheapestOn(leg.from, leg.to, day)]),
	);
	let low = Math.min(
		...[...prices.values()].filter((price): price is number => price !== undefined),
	);
	return Object.fromEntries(
		[...prices].map(([day, price]) => [
			day,
			price === undefined ? undefined : { amount: money(price), level: fareLevel(price, low) },
		]),
	);
}

/** The search with one leg's day moved, which the fare strip and calendar link to. */
function withDay(search: FlightSearch, index: number, day: string): FlightSearch {
	let legs = search.legs.map((leg, at) => (at === index ? { ...leg, day } : leg));
	if (search.trip === "round" && index === 0 && legs[1] !== undefined && legs[1].day < day)
		legs[1] = { ...legs[1], day };
	return { ...search, legs, picks: search.picks.slice(0, index) };
}

/** What has been picked so far, with a link to change each pick. */
function Picked(handle: Handle<{ search: FlightSearch }>) {
	return () => {
		let { search } = handle.props;
		if (search.picks.length === 0) return null;
		return (
			<ol
				mix={[
					raw({
						display: "grid",
						gap: "0.75rem",
						margin: "0 0 1.5rem",
						padding: "0",
						listStyle: "none",
					}),
				]}
			>
				{search.picks.map((id, index) => {
					let option = findFlight(id)!;
					return (
						<li mix={[raw({ display: "grid", gap: "0.5rem" })]}>
							<div
								mix={[
									raw({
										display: "flex",
										justifyContent: "space-between",
										alignItems: "baseline",
										gap: "1rem",
									}),
								]}
							>
								<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
									{legName(search, index)} · {formatDay(search.legs[index]!.day, { weekday: true })}
								</strong>
								<a
									href={flightsHref(
										"flights",
										{ ...search, picks: search.picks.slice(0, index) },
										false,
									)}
									mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}
								>
									Change
								</a>
							</div>
							<Journey option={option} />
						</li>
					);
				})}
			</ol>
		);
	};
}

/** What a leg is called: outbound and return on a round trip, numbered on multi-city. */
function legName(search: FlightSearch, index: number): string {
	if (search.trip === "round") return index === 0 ? "Outbound" : "Return";
	if (search.trip === "one") return "Your flight";
	return `Flight ${index + 1}`;
}

/** The multi-city leg editor: three rows of from, to and day, posted as `leg` fields. */
function MultiCityForm(handle: Handle<{ search: FlightSearch; today: string }>) {
	return () => {
		let { search, today } = handle.props;
		let rows = [0, 1, 2].map(
			(index) => search.legs[index] ?? { from: "", to: "", day: addDays(today, 30 + index * 4) },
		);
		let input = raw({
			blockSize: "2.75rem",
			paddingInline: "0.75rem",
			border: "1px solid var(--ui-neutral-border)",
			borderRadius: "var(--ui-radius-md)",
			background: "var(--ui-bg)",
			font: "inherit",
			color: "var(--ui-neutral-fg-emphasis)",
			minInlineSize: "0",
		});
		return (
			<form
				method="get"
				action={href("flights")}
				aria-label="Multi-city flights"
				mix={[raw({ display: "grid", gap: "0.75rem", maxInlineSize: "44rem" })]}
			>
				<input type="hidden" name="trip" value="multi" />
				{rows.map((leg, index) => (
					<fieldset
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
								gap: "0.5rem",
								margin: "0",
								padding: "0.75rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg)",
							}),
						]}
					>
						<legend mix={[raw({ paddingInline: "0.25rem", fontWeight: "650" })]}>
							Flight {index + 1}
						</legend>
						<select name="from" aria-label={`Flight ${index + 1} from`} mix={[input]}>
							<option value="">From…</option>
							{airportChoices().map((airport) => (
								<option value={airport.code} selected={airport.code === leg.from}>
									{airport.city} ({airport.code})
								</option>
							))}
						</select>
						<select name="to" aria-label={`Flight ${index + 1} to`} mix={[input]}>
							<option value="">To…</option>
							{airportChoices().map((airport) => (
								<option value={airport.code} selected={airport.code === leg.to}>
									{airport.city} ({airport.code})
								</option>
							))}
						</select>
						<input
							type="date"
							name="day"
							aria-label={`Flight ${index + 1} date`}
							min={today}
							value={leg.day}
							mix={[input]}
						/>
					</fieldset>
				))}
				<button type="submit" mix={primaryButton()}>
					Search these flights
				</button>
			</form>
		);
	};
}

/** Every airport, for the multi-city selects. */
function airportChoices() {
	return ["SRL", "KSH", "TMS", "PAC", "AMB", "MRW", "VLS"].map((code) => findAirport(code)!);
}

/** The brand's full-width action button. */
export function primaryButton() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			gap: "0.5rem",
			minBlockSize: "3.25rem",
			paddingInline: "1.5rem",
			border: "0",
			borderRadius: "var(--ui-radius-lg)",
			backgroundColor: "var(--ui-brand-bg-solid)",
			color: "var(--ui-brand-fg-on-solid)",
			font: "inherit",
			fontSize: "1rem",
			fontWeight: "650",
			textDecoration: "none",
			cursor: "pointer",
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-brand-bg-solid-hover)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}

/** The flights screen: the search, then the list for the leg being chosen. */
export default function FlightsPage(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let { base, today, url } = handle.props.ctx;
		let search = readFlightSearch(url.searchParams);
		let leg = currentLeg(search);
		let index = search.picks.length;
		let options = leg === undefined ? [] : findFlights(search, leg);
		let marks = standouts(options);
		let strip = leg === undefined ? [] : daysAround(leg.day, 3, 3);
		return (
			<div>
				<div
					mix={[
						raw({
							paddingInline: GUTTER,
							paddingBlock: "1.25rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							backgroundColor: "color-mix(in oklch, var(--ui-color-brand-500) 7%, var(--ui-bg))",
						}),
					]}
				>
					<div mix={[raw({ maxInlineSize: "80rem", marginInline: "auto" })]}>
						{search.trip === "multi" ? (
							<MultiCityForm search={search} today={today} />
						) : (
							<FlightSearchForm
								flight={search}
								today={today}
								base={base}
								layout="bar"
								id="flights"
							/>
						)}
					</div>
				</div>
				{leg === undefined ? (
					<NoLegLeft search={search} today={today} />
				) : (
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr)",
								gap: "2rem",
								maxInlineSize: "80rem",
								marginInline: "auto",
								paddingInline: GUTTER,
								paddingBlock: "1.5rem 3rem",
								[`@media ${SPLIT}`]: { gridTemplateColumns: "16rem minmax(0, 1fr)" },
							}),
						]}
					>
						<aside
							aria-label="Filters"
							mix={[
								raw({
									order: "2",
									[`@media ${SPLIT}`]: {
										order: "0",
										position: "sticky",
										insetBlockStart: `calc(${TOP_BAR} + 1rem)`,
										alignSelf: "start",
										maxBlockSize: `calc(100dvh - ${TOP_BAR} - 2rem)`,
										overflow: "auto",
									},
								}),
							]}
						>
							<details
								open
								mix={[
									raw({
										"& > summary": {
											cursor: "pointer",
											fontWeight: "650",
											minBlockSize: "2.75rem",
											display: "flex",
											alignItems: "center",
										},
									}),
								]}
							>
								<summary>Filters</summary>
								<Filters search={search} />
							</details>
						</aside>
						<section aria-labelledby="flight-results">
							<Picked search={search} />
							<h1
								id="flight-results"
								mix={[
									raw({
										margin: "0 0 0.25rem",
										fontFamily: "var(--ui-font-serif)",
										fontSize: "1.75rem",
										fontWeight: "600",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{legName(search, index)}: {findAirport(leg.from)!.city} to{" "}
								{findAirport(leg.to)!.city}
							</h1>
							<p mix={[raw({ margin: "0 0 1rem", color: "var(--ui-neutral-fg-muted)" })]}>
								{formatDay(leg.day, { weekday: true, year: true })} · {options.length}{" "}
								{options.length === 1 ? "flight" : "flights"} · prices for one adult,{" "}
								{FARE_CLASSES[0].name} fare
							</p>
							<FareCalendar
								variant="strip"
								days={strip}
								selected={leg.day}
								fares={faresFor(leg, strip, today)}
								href={(day) => flightsHref("flights", withDay(search, index, day))}
								today={today}
								locale="en-US"
								label="Fares on nearby days"
								labels={FARE_LABELS}
							/>
							<div
								mix={[
									raw({
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										gap: "1rem",
										flexWrap: "wrap",
										marginBlock: "1rem",
									}),
								]}
							>
								<nav
									aria-label="Sort flights"
									mix={[raw({ display: "flex", gap: "0.25rem", flexWrap: "wrap" })]}
								>
									{FLIGHT_SORTS.map((sort) => (
										<a
											href={flightsHref("flights", { ...search, sort: sort.id })}
											aria-current={search.sort === sort.id ? "true" : undefined}
											mix={[
												raw({
													display: "inline-flex",
													alignItems: "center",
													blockSize: "2.5rem",
													paddingInline: "0.875rem",
													borderRadius: "999px",
													border: "1px solid var(--ui-neutral-border)",
													color: "var(--ui-neutral-fg-emphasis)",
													fontWeight: "600",
													fontSize: "0.875rem",
													textDecoration: "none",
													"&[aria-current]": {
														backgroundColor: "var(--ui-neutral-bg-solid)",
														color: "var(--ui-neutral-fg-on-solid)",
														borderColor: "transparent",
													},
												}),
											]}
										>
											{sort.label}
										</a>
									))}
								</nav>
								<a
									href={flightsHref("flights/calendar", { ...search, picks: search.picks }, false)}
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											gap: "0.375rem",
											fontWeight: "600",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									<CalendarDaysIcon aria-hidden="true" size={18} />
									Fare calendar
								</a>
							</div>
							{options.length === 0 ? (
								<p
									mix={[
										raw({
											padding: "2rem",
											textAlign: "center",
											borderRadius: "1rem",
											backgroundColor: "var(--ui-neutral-bg-tint)",
										}),
									]}
								>
									No flights match these filters.{" "}
									<a
										href={flightsHref("flights", {
											...search,
											stops: [],
											departs: [],
											arrives: [],
											airlines: [],
											maxHours: undefined,
											maxPrice: undefined,
										})}
									>
										Clear the filters
									</a>
								</p>
							) : (
								<ol
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
									{options.map((option) => {
										let first = option.segments[0]!;
										let last = option.segments.at(-1)!;
										return (
											<li>
												<FlightOption
													price={money(option.price)}
													priceDetail={
														search.trip === "round" ? "per adult, each way" : "per adult"
													}
													featured={option.id === marks.cheapest}
													badges={
														<>
															{option.id === marks.cheapest ? (
																<Badge color="success">Cheapest</Badge>
															) : null}
															{option.id === marks.fastest ? (
																<Badge color="brand">Fastest</Badge>
															) : null}
														</>
													}
													action={
														<a
															href={flightsHref(
																"flights",
																{ ...search, picks: [...search.picks, option.id] },
																false,
															)}
															mix={primaryButton()}
															aria-label={`Select ${first.flight} at ${clock(first.departs, first.from)}`}
														>
															Select
														</a>
													}
												>
													<FlightOption.Journey
														airline={findAirline(first.airline)?.name ?? first.airline}
														mark={<AirlineMark code={first.airline} />}
														departure={{ time: clock(first.departs, first.from), code: first.from }}
														arrival={{ time: clock(last.arrives, last.to), code: last.to }}
														duration={formatMinutes(journeyMinutes(option))}
														stops={option.segments.length - 1}
														stopsLabel={stopsText(option)}
														dayOffset={dayOffset(option)}
														dayOffsetLabel="arrives the next day"
													/>
												</FlightOption>
											</li>
										);
									})}
								</ol>
							)}
						</section>
					</div>
				)}
			</div>
		);
	};
}

/**
 * What the flights screen shows with no leg left to choose: the picked flights and the way to
 * fares once every leg has one, or popular routes before anything is searched.
 */
function NoLegLeft(handle: Handle<{ search: FlightSearch; today: string }>) {
	return () => {
		let { search, today } = handle.props;
		if (search.legs.length === 0) {
			return (
				<Page>
					<Title>Where are you flying?</Title>
					<p mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
						Pick where from and where to, then a day. The strip above your results shows the fares
						around it.
					</p>
					<PopularRoutes today={today} />
				</Page>
			);
		}
		return (
			<Page narrow>
				<Title>Your flights</Title>
				<div mix={[raw({ marginBlockStart: "1.5rem" })]}>
					<Picked search={search} />
				</div>
				<a href={flightsHref("flights/fares", search, false)} mix={primaryButton()}>
					Choose your fare
				</a>
			</Page>
		);
	};
}

/** Routes worth a look on the empty flights screen, each a search link for a month ahead. */
function PopularRoutes(handle: Handle<{ today: string }>) {
	return () => {
		let day = addDays(handle.props.today, 30);
		let routes = [
			["SRL", "MRW"],
			["KSH", "VLS"],
			["TMS", "MRW"],
			["PAC", "VLS"],
		];
		return (
			<ul
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))",
						gap: "1rem",
						margin: "1.5rem 0 0",
						padding: "0",
						listStyle: "none",
					}),
				]}
			>
				{routes.map(([from = "", to = ""]) => {
					let price = cheapestOn(from, to, day);
					return (
						<li>
							<a
								href={href(`flights?from=${from}&to=${to}&depart=${day}&return=${addDays(day, 5)}`)}
								mix={[
									raw({
										display: "grid",
										gap: "0.25rem",
										padding: "1rem 1.25rem",
										borderRadius: "1rem",
										boxShadow: "0 0 0 1px var(--ui-neutral-border)",
										color: "inherit",
										textDecoration: "none",
									}),
									when(
										"&:hover",
										raw({
											boxShadow:
												"0 0 0 1px var(--ui-neutral-fg-muted), 0 8px 20px -12px rgb(0 0 0 / 0.3)",
										}),
									),
								]}
							>
								<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
									{findAirport(from)!.city} → {findAirport(to)!.city}
								</strong>
								<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
									Round trip from {price === undefined ? "—" : money(price * 2)}
								</span>
							</a>
						</li>
					);
				})}
			</ul>
		);
	};
}

/** The month of fares for the leg being chosen, each day a link back to the list. */
export function FareCalendarPage(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let { today, url } = handle.props.ctx;
		let search = readFlightSearch(url.searchParams);
		let index = Math.min(search.picks.length, search.legs.length - 1);
		let leg = search.legs[index];
		if (leg === undefined) return <FlightsPage ctx={handle.props.ctx} />;
		let month = url.searchParams.get("month") ?? leg.day.slice(0, 7);
		let first = `${month}-01`;
		let days = Array.from({ length: 31 }, (_, offset) => addDays(first, offset)).filter((day) =>
			day.startsWith(month),
		);
		let shift = (step: number) => {
			let date = new Date(`${first}T00:00:00Z`);
			date.setUTCMonth(date.getUTCMonth() + step);
			return date.toISOString().slice(0, 7);
		};
		let calendarHref = (next: string) =>
			`${flightsHref("flights/calendar", search, false)}&month=${next}`;
		return (
			<Page narrow>
				<a
					href={flightsHref("flights", search)}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							minBlockSize: "2.75rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
						}),
					]}
				>
					<ChevronLeftIcon aria-hidden="true" size={18} />
					Back to flights
				</a>
				<Title>
					Fares from {findAirport(leg.from)!.city} to {findAirport(leg.to)!.city}
				</Title>
				<p mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
					The lowest one-way fare for one adult each day. Pick a day to see its flights.
				</p>
				<FareCalendar
					headingLevel={2}
					month={month}
					fares={faresFor(leg, days, today)}
					selected={leg.day}
					href={(day) => flightsHref("flights", withDay(search, index, day))}
					prevHref={month > today.slice(0, 7) ? calendarHref(shift(-1)) : undefined}
					nextHref={calendarHref(shift(1))}
					today={today}
					locale="en-US"
					label={`Fares in ${month}`}
					labels={FARE_LABELS}
				/>
			</Page>
		);
	};
}

/** The step after picking flights: the fare class every flight is booked in. */
export function FaresPage(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let search = readFlightSearch(handle.props.ctx.url.searchParams);
		let picked = search.picks.map((id) => findFlight(id)!);
		let travellers = search.adults + search.children;
		return (
			<Page narrow>
				<a
					href={flightsHref("flights", search, false)}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							minBlockSize: "2.75rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
						}),
					]}
				>
					<ChevronLeftIcon aria-hidden="true" size={18} />
					Back to flights
				</a>
				<Title>Choose your fare</Title>
				<div mix={[raw({ display: "grid", gap: "0.75rem", marginBlock: "1.5rem" })]}>
					{picked.map((option, index) => (
						<Journey
							option={option}
							title={`${legName(search, index)} · ${formatDay(search.legs[index]!.day, { weekday: true })}`}
						/>
					))}
				</div>
				<form
					method="get"
					action={href("flights/seats")}
					mix={[raw({ display: "grid", gap: "1.5rem" })]}
				>
					{[...new URLSearchParams(writeFlightSearch({ ...search, fare: "standard" }, false))]
						.filter(([name]) => name !== "fare")
						.map(([name, value]) => (
							<input type="hidden" name={name} value={value} />
						))}
					<FareOptions legend="Fare" name="fare" statusLabels={STATUS_LABELS}>
						{FARE_CLASSES.map((fare) => {
							let total = picked.reduce((sum, option) => sum + farePrice(option, fare.id), 0);
							return (
								<FareOptions.Option
									value={fare.id}
									title={fare.name}
									price={money(total)}
									priceDetail={`per adult, ${picked.length === 1 ? "one flight" : `${picked.length} flights`}`}
									features={fare.features.map((feature) => ({
										label: feature.label,
										included: feature.included,
									}))}
									ribbon={fare.id === "standard" ? "Most picked" : undefined}
									checked={search.fare === fare.id}
								/>
							);
						})}
					</FareOptions>
					<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
						{travellers} {travellers === 1 ? "traveller" : "travellers"} · taxes and airport charges
						are added at checkout.
					</p>
					<button type="submit" mix={primaryButton()}>
						Continue to seats
					</button>
				</form>
			</Page>
		);
	};
}

/** Every segment of the picked flights, in flying order. */
function segmentsOf(search: FlightSearch): Segment[] {
	return search.picks.flatMap((id) => findFlight(id)?.segments ?? []);
}

/** The seats picked so far, one per segment in order, read from repeated `seat` fields. */
function readSeats(params: URLSearchParams, segments: Segment[]): string[] {
	return params
		.getAll("seat")
		.slice(0, segments.length)
		.filter((seat, index) =>
			cabinOf(segments[index]!).rows.some((row) =>
				row.seats.some((entry) => entry.id === seat && entry.status === "available"),
			),
		);
}

/** One segment's seat map, chosen in turn; the form carries the seats already picked. */
export function SeatsPage(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let params = handle.props.ctx.url.searchParams;
		let search = readFlightSearch(params);
		let segments = segmentsOf(search);
		let seats = readSeats(params, segments);
		let index = seats.length;
		let segment = segments[index];
		let hidden = [...new URLSearchParams(writeFlightSearch(search, false))];
		if (segment === undefined) {
			let problem = FLIGHT_PROBLEMS[params.get("problem") ?? ""];
			return (
				<FlightCheckout ctx={handle.props.ctx} problems={problem === undefined ? [] : [problem]} />
			);
		}
		let cabin = cabinOf(segment);
		let from = findAirport(segment.from)!;
		let to = findAirport(segment.to)!;
		return (
			<Page narrow>
				<a
					href={flightsHref("flights/fares", search, false)}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							minBlockSize: "2.75rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
						}),
					]}
				>
					<ChevronLeftIcon aria-hidden="true" size={18} />
					Back to fares
				</a>
				<Title>Pick a seat</Title>
				<p mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
					Flight {index + 1} of {segments.length}: {segment.flight}, {from.city} to {to.city} ·{" "}
					{segment.aircraft}.{" "}
					{search.fare === "basic"
						? "Seats cost extra on a Basic fare."
						: "Seat choice is included in your fare."}{" "}
					Travellers in your party sit together.
				</p>
				<form
					method="get"
					action={href("flights/seats")}
					mix={[raw({ display: "grid", gap: "1.25rem", marginBlockStart: "1rem" })]}
				>
					{hidden.map(([name, value]) => (
						<input type="hidden" name={name} value={value} />
					))}
					{seats.map((seat) => (
						<input type="hidden" name="seat" value={seat} />
					))}
					<SeatMap.Legend
						items={[
							{ swatch: "available", label: "Available" },
							{ swatch: "selected", label: "Your seat" },
							{ swatch: "taken", label: "Taken" },
							{ swatch: "extra-legroom", label: "Extra legroom" },
							{ swatch: "exit", label: "Exit row" },
						]}
					/>
					<div mix={[raw({ maxBlockSize: "70dvh", overflow: "auto", borderRadius: "1rem" })]}>
						<SeatMap
							rows={cabin.rows.map((row) => ({
								number: row.number,
								seats: row.seats.map((seat) => ({
									id: seat.id,
									status: seat.status,
									kind: seat.kind,
									price: seatFee(search.fare, seat.price) > 0 ? money(seat.price) : undefined,
								})),
							}))}
							layout={cabin.layout}
							name="seat"
							label={`Seats on ${segment.flight}`}
							labels={{
								taken: "Taken",
								aisle: "Aisle",
								window: "Window",
								exit: "Exit",
								kinds: { "extra-legroom": "Extra legroom", exit: "Exit row" },
							}}
							exitRows={cabin.exits}
							required
						/>
					</div>
					<button type="submit" mix={primaryButton()}>
						{index + 1 < segments.length ? "Next flight" : "Continue to passengers"}
					</button>
				</form>
			</Page>
		);
	};
}

namespace FlightCheckout {
	export interface Props {
		ctx: Screen;
		/** Problems a refused booking post came back with. */
		problems?: string[];
	}
}

/** Passengers and payment: names for every traveller, a saved card, and the price. */
export function FlightCheckout(handle: Handle<FlightCheckout.Props>) {
	return () => {
		let params = handle.props.ctx.url.searchParams;
		let search = readFlightSearch(params);
		let segments = segmentsOf(search);
		let seats = readSeats(params, segments);
		let picked = search.picks.map((id) => findFlight(id)!);
		let fees = segments.map((segment, index) => {
			let seat = cabinOf(segment)
				.rows.flatMap((row) => row.seats)
				.find((entry) => entry.id === seats[index]);
			return seat === undefined
				? 0
				: seatFee(search.fare, seat.price) * (search.adults + search.children);
		});
		let quote = flightQuote(
			picked.map((option) => ({
				option,
				fare: search.fare,
				seatFees: option.segments.reduce(
					(sum, segment) => sum + (fees[segments.indexOf(segment)] ?? 0),
					0,
				),
			})),
			search.adults,
			search.children,
		);
		let travellers = Array.from({ length: search.adults + search.children }, (_, index) =>
			index < search.adults ? "Adult" : "Child",
		);
		let field = raw({
			blockSize: "2.75rem",
			paddingInline: "0.75rem",
			border: "1px solid var(--ui-neutral-border)",
			borderRadius: "var(--ui-radius-md)",
			background: "var(--ui-bg)",
			font: "inherit",
			color: "var(--ui-neutral-fg-emphasis)",
			minInlineSize: "0",
		});
		return (
			<Page narrow>
				<Title>Passengers and payment</Title>
				{handle.props.problems === undefined || handle.props.problems.length === 0 ? null : (
					<ul
						role="alert"
						mix={[
							raw({
								margin: "1rem 0",
								padding: "1rem 1.25rem 1rem 2rem",
								borderRadius: "1rem",
								backgroundColor: "var(--ui-danger-bg-tint)",
								color: "var(--ui-danger-fg)",
							}),
						]}
					>
						{handle.props.problems.map((problem) => (
							<li>{problem}</li>
						))}
					</ul>
				)}
				<form
					method="post"
					action={actionHref("flights/book")}
					data-main-scroll-top=""
					mix={[
						raw({
							display: "grid",
							gap: "2rem",
							marginBlockStart: "1.5rem",
							"@media (min-width: 56rem)": {
								gridTemplateColumns: "minmax(0, 1fr) 22rem",
								alignItems: "start",
							},
						}),
					]}
				>
					{[...new URLSearchParams(writeFlightSearch(search, false))].map(([name, value]) => (
						<input type="hidden" name={name} value={value} />
					))}
					{seats.map((seat) => (
						<input type="hidden" name="seat" value={seat} />
					))}
					<div mix={[raw({ display: "grid", gap: "1.5rem" })]}>
						{travellers.map((kind, index) => (
							<fieldset
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
										gap: "0.75rem",
										margin: "0",
										padding: "1rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-radius-lg)",
									}),
								]}
							>
								<legend mix={[raw({ paddingInline: "0.25rem", fontWeight: "650" })]}>
									Traveller {index + 1} · {kind}
								</legend>
								<label mix={[raw({ display: "grid", gap: "0.25rem", fontSize: "0.875rem" })]}>
									Given names
									<input
										name="given"
										required
										autocomplete={index === 0 ? "given-name" : "off"}
										value={index === 0 ? TRAVELLER.first : ""}
										mix={[field]}
									/>
								</label>
								<label mix={[raw({ display: "grid", gap: "0.25rem", fontSize: "0.875rem" })]}>
									Surname
									<input
										name="family"
										required
										autocomplete={index === 0 ? "family-name" : "off"}
										value={index === 0 ? TRAVELLER.name.split(" ").at(-1) : ""}
										mix={[field]}
									/>
								</label>
							</fieldset>
						))}
						<fieldset
							mix={[
								raw({ display: "grid", gap: "0.75rem", margin: "0", padding: "0", border: "0" }),
							]}
						>
							<legend
								mix={[raw({ marginBlockEnd: "0.5rem", fontWeight: "650", fontSize: "1.125rem" })]}
							>
								Pay with
							</legend>
							<p
								mix={[
									raw({
										display: "flex",
										gap: "0.5rem",
										margin: "0",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								<ShieldCheckIcon aria-hidden="true" size={18} />
								These saved cards are invented. Booking charges nothing.
							</p>
							{SAVED_CARDS.map((card, index) => (
								<label
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "1rem",
											padding: "0.875rem 1rem",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "var(--ui-radius-lg)",
											cursor: "pointer",
											"&:has(:checked)": {
												borderColor: "var(--ui-neutral-fg-emphasis)",
												boxShadow: "inset 0 0 0 1px var(--ui-neutral-fg-emphasis)",
											},
										}),
									]}
								>
									<span>
										<strong>
											{card.brand} ending in {card.last4}
										</strong>{" "}
										<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
											· expires {card.expires}
										</span>
									</span>
									<input
										type="radio"
										name="card"
										value={card.id}
										checked={index === 0}
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
						</fieldset>
						<button type="submit" mix={primaryButton()}>
							Book and pay {money(quote.total)}
						</button>
					</div>
					<aside
						aria-label="Your flights"
						mix={[
							raw({
								display: "grid",
								gap: "1rem",
								padding: "1.25rem",
								borderRadius: "1rem",
								boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						{picked.map((option, index) => (
							<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
								<strong>
									{legName(search, index)} · {formatDay(search.legs[index]!.day, { weekday: true })}
								</strong>
								<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{option.segments[0]!.from} → {option.segments.at(-1)!.to} · {stopsText(option)} ·
									seats{" "}
									{option.segments
										.map((segment) => seats[segments.indexOf(segment)] ?? "—")
										.join(", ")}
								</span>
							</div>
						))}
						<PriceBreakdown note="Prices in US dollars for the whole party.">
							{quote.lines.map((line) => (
								<PriceBreakdown.Line
									label={line.label}
									detail={line.detail}
									amount={money(line.cents)}
									line={line.key}
								/>
							))}
							<PriceBreakdown.Total label="Total" amount={money(quote.total)} />
						</PriceBreakdown>
					</aside>
				</form>
			</Page>
		);
	};
}
