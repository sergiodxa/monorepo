/**
 * The one search a traveller starts from, with a tab each for stays, flights, cars and
 * packages. Every tab is a plain GET form sharing the date range picker and the party
 * steppers, so a search is an address and works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BedDoubleIcon,
	CarIcon,
	PackageIcon,
	PlaneIcon,
	PlaneTakeoffIcon,
	SearchIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Autocomplete } from "@sdxc/ui/autocomplete";

import type { CarSearch } from "./cars";
import type { FlightSearch } from "./flight-query";
import type { Search } from "./query";

import { RENTAL_PLACES } from "./cars";
import { PLACES, findPlace, href } from "./data";
import { DatesField } from "./dates-field";
import { AIRPORTS, airportLabel, findAirport } from "./flights";
import { GuestsField } from "./guests-field";
import { WIDE } from "./layout";

/** The tabs of the search, in order. */
export const SEARCH_TABS = [
	{ id: "stays", label: "Stays", icon: BedDoubleIcon },
	{ id: "flights", label: "Flights", icon: PlaneIcon },
	{ id: "cars", label: "Cars", icon: CarIcon },
	{ id: "packages", label: "Packages", icon: PackageIcon },
] as const;

/** One search tab's id. */
export type SearchTab = (typeof SEARCH_TABS)[number]["id"];

/** Reads the tab an address asks for; stays when it names none. */
export function readTab(value: string | null): SearchTab {
	return SEARCH_TABS.find((tab) => tab.id === value)?.id ?? "stays";
}

namespace SearchTabs {
	export interface Props {
		current: SearchTab;
		/** The address each tab's link loads, so switching works without script. */
		hrefFor: (tab: SearchTab) => string;
		/** Light text for tabs sitting on a picture. */
		tone?: "default" | "inverse";
	}
}

/** The row of tabs over the search: links that keep the page and swap the form. */
export function SearchTabs(handle: Handle<SearchTabs.Props>) {
	return () => {
		let { current, hrefFor } = handle.props;
		return (
			<nav
				aria-label="What to search"
				mix={[
					raw({
						display: "flex",
						gap: "0.25rem",
						overflowX: "auto",
						scrollbarWidth: "none",
						maxInlineSize: "100%",
					}),
				]}
			>
				{SEARCH_TABS.map((tab) => {
					let Icon = tab.icon;
					return (
						<a
							href={hrefFor(tab.id)}
							aria-current={tab.id === current ? "page" : undefined}
							data-search-tab={tab.id}
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									flexShrink: "0",
									blockSize: "2.75rem",
									paddingInline: "1rem",
									borderRadius: "999px",
									color: "var(--ui-neutral-fg)",
									fontWeight: "600",
									textDecoration: "none",
									"&[aria-current='page']": {
										backgroundColor: "var(--ui-neutral-bg-solid)",
										color: "var(--ui-neutral-fg-on-solid)",
									},
								}),
								when(
									"&:hover:not([aria-current])",
									raw({ backgroundColor: "var(--ui-neutral-bg-tint)" }),
								),
								when(
									"&:focus-visible",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
							]}
						>
							<Icon aria-hidden="true" size={18} />
							{tab.label}
						</a>
					);
				})}
			</nav>
		);
	};
}

/** The rounded bar a wide search sits in, or the stack of cards a phone's sheet shows. */
function formShell(layout: "bar" | "stack", columns: string) {
	if (layout === "stack") return raw({ display: "grid", gap: "0.75rem" });
	return raw({
		display: "grid",
		gridTemplateColumns: "minmax(0, 1fr)",
		inlineSize: "min(100%, 60rem)",
		padding: "0.375rem",
		borderRadius: "2rem",
		backgroundColor: "var(--ui-bg)",
		boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 8px 28px -12px rgb(0 0 0 / 0.25)",
		textAlign: "start",
		[`@media ${WIDE}`]: {
			gridTemplateColumns: columns,
			alignItems: "stretch",
			borderRadius: "999px",
			minBlockSize: "4rem",
		},
	});
}

/** One labelled part of a search: a caption over its control, a card in the stack. */
function Segment(
	handle: Handle<{ label: string; htmlFor?: string; layout: "bar" | "stack"; children: RemixNode }>,
) {
	return () => {
		let { children, htmlFor, label, layout } = handle.props;
		return (
			<label
				htmlFor={htmlFor}
				mix={[
					raw({
						display: "grid",
						alignContent: "center",
						gap: "0.125rem",
						minInlineSize: "0",
						paddingInline: layout === "bar" ? "1.25rem" : "1rem",
						paddingBlock: layout === "bar" ? "0.5rem" : "0.75rem",
						borderRadius: layout === "bar" ? "999px" : "var(--ui-radius-lg)",
						border: layout === "bar" ? "0" : "1px solid var(--ui-neutral-border)",
						backgroundColor: layout === "bar" ? "transparent" : "var(--ui-bg)",
						"&:focus-within": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" },
					}),
				]}
			>
				<span
					mix={[
						raw({
							fontSize: "0.75rem",
							fontWeight: "700",
							letterSpacing: "0.02em",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{label}
				</span>
				{children}
			</label>
		);
	};
}

/** A segment holding an island field that draws its own captions, such as the dates. */
function Bare(handle: Handle<{ layout: "bar" | "stack"; children: RemixNode }>) {
	return () =>
		handle.props.layout === "bar" ? (
			<div mix={[raw({ minInlineSize: "0", display: "grid" })]}>{handle.props.children}</div>
		) : (
			<div
				mix={[
					raw({
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						overflow: "clip",
						backgroundColor: "var(--ui-bg)",
					}),
				]}
			>
				{handle.props.children}
			</div>
		);
}

/** The search button: round in the bar, a full-width block in the stack. */
function Submit(handle: Handle<{ layout: "bar" | "stack"; label?: string }>) {
	return () => (
		<button
			type="submit"
			aria-label={handle.props.label ?? "Search"}
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					gap: "0.5rem",
					minInlineSize: "3.25rem",
					minBlockSize: "3.25rem",
					paddingInline: "1.25rem",
					border: "0",
					borderRadius: handle.props.layout === "bar" ? "999px" : "var(--ui-radius-lg)",
					backgroundColor: "var(--ui-brand-bg-solid)",
					color: "var(--ui-brand-fg-on-solid)",
					font: "inherit",
					fontWeight: "650",
					cursor: "pointer",
				}),
				when("&:hover", raw({ backgroundColor: "var(--ui-brand-bg-solid-hover)" })),
				when(
					"&:focus-visible",
					raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
				),
			]}
		>
			<SearchIcon aria-hidden="true" size={18} />
			<span>{handle.props.label ?? "Search"}</span>
		</button>
	);
}

/** Every airport as a suggestion row. */
function airportOptions() {
	return AIRPORTS.map((airport) => ({
		value: airport.code,
		label: airportLabel(airport),
		description: airport.name,
		icon: <PlaneTakeoffIcon size={20} />,
	}));
}

/** The text style of a bare field inside a segment. */
const BARE_INPUT = [raw({ fontSize: "0.9375rem", blockSize: "auto", padding: "0" })];

/** A native select styled to sit bare inside a segment. */
function selectStyle() {
	return raw({
		inlineSize: "100%",
		minInlineSize: "0",
		padding: "0",
		border: "0",
		background: "transparent",
		font: "inherit",
		fontSize: "0.9375rem",
		color: "var(--ui-neutral-fg-emphasis)",
		outline: "none",
	});
}

namespace FlightSearchForm {
	export interface Props {
		flight: FlightSearch;
		today: string;
		base: string;
		layout: "bar" | "stack";
		id: string;
	}
}

/**
 * The flight search: round trip or one-way (multi-city opens its own leg editor on the flights
 * page), from and to with airport suggestions, the dates and the passengers.
 */
export function FlightSearchForm(handle: Handle<FlightSearchForm.Props>) {
	return () => {
		let { base, flight, id, layout, today } = handle.props;
		let first = flight.legs[0];
		let back = flight.trip === "round" ? flight.legs[1]?.day : undefined;
		let from = first === undefined ? "" : airportLabel(findAirport(first.from)!);
		let to = first === undefined ? "" : airportLabel(findAirport(first.to)!);
		let one = flight.trip === "one";
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gap: "0.75rem",
						inlineSize: layout === "bar" ? "min(100%, 60rem)" : "auto",
					}),
				]}
			>
				<div
					role="radiogroup"
					aria-label="Kind of trip"
					mix={[raw({ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.875rem" })]}
				>
					{(
						[
							["round", "Round trip"],
							["one", "One-way"],
							["multi", "Multi-city"],
						] as const
					).map(([kind, label]) => (
						<label
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									fontWeight: "600",
									cursor: "pointer",
								}),
							]}
						>
							<input
								type="radio"
								name="trip"
								value={kind}
								form={`${id}-form`}
								checked={flight.trip === kind}
								mix={[
									raw({
										accentColor: "var(--ui-brand-bg-solid)",
										inlineSize: "1.125rem",
										blockSize: "1.125rem",
									}),
								]}
							/>
							{label}
						</label>
					))}
				</div>
				<form
					id={`${id}-form`}
					method="get"
					action={href("flights")}
					role="search"
					aria-label="Search flights"
					mix={[
						formShell(
							layout,
							"minmax(9rem, 1fr) minmax(9rem, 1fr) minmax(13rem, 1.4fr) minmax(8rem, 0.9fr) auto",
						),
					]}
				>
					<Segment label="From" htmlFor={`${id}-from`} layout={layout}>
						<Autocomplete
							id={`${id}-from`}
							name="from"
							label="From"
							placeholder="City or airport"
							defaultValue={from}
							variant="bare"
							options={airportOptions()}
							parts={{ input: BARE_INPUT }}
						/>
					</Segment>
					<Segment label="To" htmlFor={`${id}-to`} layout={layout}>
						<Autocomplete
							id={`${id}-to`}
							name="to"
							label="To"
							placeholder="City or airport"
							defaultValue={to}
							variant="bare"
							options={airportOptions()}
							parts={{ input: BARE_INPUT }}
						/>
					</Segment>
					<Bare layout={layout}>
						<DatesField
							id={`${id}-dates`}
							start={first?.day}
							end={back}
							today={today}
							base={base}
							months={layout === "bar" ? 2 : 1}
							names={{ start: "depart", end: "return" }}
							captions={{ start: "Depart", end: "Return" }}
							single={one}
							boxed={layout === "stack"}
						/>
					</Bare>
					<Bare layout={layout}>
						<GuestsField
							id={`${id}-people`}
							adults={flight.adults}
							kids={flight.children}
							max={9}
							caption="Passengers"
							hints={{ adults: "Ages 12 or above", children: "Ages 2 to 11" }}
							boxed={layout === "stack"}
						/>
					</Bare>
					<Submit layout={layout} label="Search flights" />
				</form>
			</div>
		);
	};
}

namespace CarSearchForm {
	export interface Props {
		car: CarSearch;
		today: string;
		base: string;
		layout: "bar" | "stack";
		id: string;
	}
}

/** Every half hour of a day, as a pickup or drop-off time choice. */
const TIMES = Array.from(
	{ length: 48 },
	(_, index) =>
		`${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`,
);

/** A place picker: a native select of the rental desks. */
function PlaceSelect(
	handle: Handle<{ id: string; name: string; value: string; withSame?: boolean }>,
) {
	return () => (
		<select id={handle.props.id} name={handle.props.name} mix={[selectStyle()]}>
			{RENTAL_PLACES.map((place) => (
				<option value={place.id} selected={place.id === handle.props.value}>
					{place.name}
				</option>
			))}
		</select>
	);
}

/** A time picker on the half hour. */
function TimeSelect(handle: Handle<{ id: string; name: string; value: string; label: string }>) {
	return () => (
		<select
			id={handle.props.id}
			name={handle.props.name}
			aria-label={handle.props.label}
			mix={[selectStyle()]}
		>
			{TIMES.map((time) => (
				<option value={time} selected={time === handle.props.value}>
					{time}
				</option>
			))}
		</select>
	);
}

/** The car search: pickup and drop-off places, the days and the times. */
export function CarSearchForm(handle: Handle<CarSearchForm.Props>) {
	return () => {
		let { base, car, id, layout, today } = handle.props;
		return (
			<form
				method="get"
				action={href("cars")}
				role="search"
				aria-label="Search cars"
				mix={[
					formShell(
						layout,
						"minmax(10rem, 1.2fr) minmax(10rem, 1.2fr) minmax(13rem, 1.5fr) minmax(5rem, 0.6fr) minmax(5rem, 0.6fr) auto",
					),
				]}
			>
				<Segment label="Pick up at" htmlFor={`${id}-pickup`} layout={layout}>
					<PlaceSelect id={`${id}-pickup`} name="pickup" value={car.place} />
				</Segment>
				<Segment label="Drop off at" htmlFor={`${id}-dropoff`} layout={layout}>
					<PlaceSelect id={`${id}-dropoff`} name="dropoff" value={car.dropoff} />
				</Segment>
				<Bare layout={layout}>
					<DatesField
						id={`${id}-days`}
						start={car.pickupDay}
						end={car.dropoffDay}
						today={today}
						base={base}
						months={layout === "bar" ? 2 : 1}
						names={{ start: "pickupday", end: "dropoffday" }}
						captions={{ start: "Pick up", end: "Drop off" }}
						boxed={layout === "stack"}
					/>
				</Bare>
				<Segment label="Time" htmlFor={`${id}-at`} layout={layout}>
					<TimeSelect id={`${id}-at`} name="at" value={car.pickupTime} label="Pickup time" />
				</Segment>
				<Segment label="Return" htmlFor={`${id}-until`} layout={layout}>
					<TimeSelect
						id={`${id}-until`}
						name="until"
						value={car.dropoffTime}
						label="Drop-off time"
					/>
				</Segment>
				<Submit layout={layout} label="Search cars" />
			</form>
		);
	};
}

namespace PackageSearchForm {
	export interface Props {
		search: Search;
		/** The airport the traveller flies from. */
		origin: string;
		today: string;
		base: string;
		layout: "bar" | "stack";
		id: string;
	}
}

/** The package search: where from, which place to stay in, the dates and who is going. */
export function PackageSearchForm(handle: Handle<PackageSearchForm.Props>) {
	return () => {
		let { base, id, layout, origin, search, today } = handle.props;
		let place = search.place === undefined ? "" : (findPlace(search.place)?.name ?? "");
		return (
			<form
				method="get"
				action={href("packages")}
				role="search"
				aria-label="Search packages"
				mix={[
					formShell(
						layout,
						"minmax(9rem, 1fr) minmax(9rem, 1fr) minmax(13rem, 1.4fr) minmax(8rem, 0.9fr) auto",
					),
				]}
			>
				<Segment label="Flying from" htmlFor={`${id}-origin`} layout={layout}>
					<Autocomplete
						id={`${id}-origin`}
						name="origin"
						label="Flying from"
						placeholder="City or airport"
						defaultValue={airportLabel(findAirport(origin) ?? AIRPORTS[0]!)}
						variant="bare"
						options={airportOptions().filter(
							(option) => findAirport(option.value)?.place === undefined,
						)}
						parts={{ input: BARE_INPUT }}
					/>
				</Segment>
				<Segment label="Staying in" htmlFor={`${id}-where`} layout={layout}>
					<Autocomplete
						id={`${id}-where`}
						name="where"
						label="Staying in"
						placeholder="A place on the coast"
						defaultValue={place}
						variant="bare"
						options={PLACES.map((entry) => ({
							value: entry.id,
							label: entry.name,
							description: entry.blurb,
						}))}
						parts={{ input: BARE_INPUT }}
					/>
				</Segment>
				<Bare layout={layout}>
					<DatesField
						id={`${id}-dates`}
						start={search.start}
						end={search.end}
						today={today}
						base={base}
						months={layout === "bar" ? 2 : 1}
						boxed={layout === "stack"}
					/>
				</Bare>
				<Bare layout={layout}>
					<GuestsField
						id={`${id}-people`}
						adults={search.adults}
						kids={search.children}
						caption="Travellers"
						boxed={layout === "stack"}
					/>
				</Bare>
				<Submit layout={layout} label="Search packages" />
			</form>
		);
	};
}
