/**
 * Wayfern's car screens: the rental search with its offers by class, and one offer's checkout
 * where extras re-price the rental through the form and a saved card books it. Every filter
 * and extra lives in the address or the form, so the flow works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronLeftIcon, ShieldCheckIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Badge, Checkbox } from "@sdxc/ui";
import { CarOffer } from "@sdxc/ui/travel/car-offer";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";

import type { CarExtra, CarOfferData, CarSearch } from "./cars";
import type { Screen } from "./screen";

import { CarArt } from "./car-art";
import {
	CAR_CLASSES,
	CAR_EXTRAS,
	carOffers,
	findCarOffer,
	findRentalPlace,
	readCarSearch,
	writeCarSearch,
} from "./cars";
import { SAVED_CARDS, actionHref, href } from "./data";
import { addDays, formatDay, readDay } from "./days";
import { zonedInstant } from "./flights";
import { primaryButton } from "./flights-view";
import { COAST_ZONE } from "./itinerary";
import { GUTTER } from "./layout";
import { Page, Title } from "./parts";
import { money } from "./pricing";
import { carQuote } from "./travel-pricing";
import { CarSearchForm } from "./travel-search";

/** The pickup and drop-off instants a search names, defaulting to a long weekend two weeks out. */
export function rentalWindow(
	search: CarSearch,
	today: string,
): { pickup: number; dropoff: number; pickupDay: string; dropoffDay: string } {
	let pickupDay = search.pickupDay ?? addDays(today, 14);
	let dropoffDay = search.dropoffDay ?? addDays(pickupDay, 3);
	let minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
	return {
		pickupDay,
		dropoffDay,
		pickup: zonedInstant(pickupDay, minutes(search.pickupTime), COAST_ZONE),
		dropoff: zonedInstant(dropoffDay, minutes(search.dropoffTime), COAST_ZONE),
	};
}

/** A cars page address. */
function carsHref(page: string, search: CarSearch): string {
	return href(`${page}?${writeCarSearch(search)}`);
}

/** One offer as a results card, with its drawing, specs, company, and the rental's total. */
function Offer(handle: Handle<{ offer: CarOfferData; search: CarSearch; today: string }>) {
	return () => {
		let { offer, search, today } = handle.props;
		let window = rentalWindow(search, today);
		let quote = carQuote(offer, window.pickup, window.dropoff, [], search.dropoff !== search.place);
		let { car } = offer;
		return (
			<CarOffer
				art={<CarArt car={car} />}
				category={car.name}
				model={`${car.model} or similar`}
				level={2}
				specs={[
					{ kind: "seats", label: `${car.seats} seats` },
					{ kind: "bags", label: `${car.bags} ${car.bags === 1 ? "bag" : "bags"}` },
					{ kind: "transmission", label: car.transmission },
					{ kind: car.fuel === "Electric" ? "electric" : "fuel", label: car.fuel },
					{ kind: "ac", label: "Air conditioning" },
				]}
				perks={offer.freeCancel ? ["Free cancellation until pickup"] : undefined}
				vendor={offer.company.name}
				rating={offer.company.rating.toFixed(1)}
				pickup={findRentalPlace(search.place)?.name}
				badges={
					offer.daily ===
					Math.min(
						...carOffers(search.place)
							.filter((entry) => entry.car.id === car.id)
							.map((entry) => entry.daily),
					) ? (
						<Badge color="success">Best price for {car.name.toLowerCase()}</Badge>
					) : undefined
				}
				price={money(offer.daily)}
				priceUnit="/ day"
				total={`${money(quote.total)} total`}
				actions={
					<a
						href={carsHref(`cars/${offer.id}`, search)}
						mix={primaryButton()}
						aria-label={`Choose the ${car.name} from ${offer.company.name}`}
					>
						Choose
					</a>
				}
			/>
		);
	};
}

/** The cars screen: the search, class chips, and every offer at the pickup place. */
export default function CarsPage(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let { base, today, url } = handle.props.ctx;
		let search = readCarSearch(url.searchParams, readDay);
		let window = rentalWindow(search, today);
		let offers = carOffers(search.place)
			.filter((offer) => search.classes.length === 0 || search.classes.includes(offer.car.id))
			.sort((a, b) =>
				search.sort === "rating" ? b.company.rating - a.company.rating : a.daily - b.daily,
			);
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
						<CarSearchForm car={search} today={today} base={base} layout="bar" id="cars" />
					</div>
				</div>
				<Page>
					<Title>Cars at {findRentalPlace(search.place)?.name}</Title>
					<p mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
						{formatDay(window.pickupDay, { weekday: true })} {search.pickupTime} to{" "}
						{formatDay(window.dropoffDay, { weekday: true })} {search.dropoffTime}
						{search.dropoff === search.place
							? ""
							: ` · returned to ${findRentalPlace(search.dropoff)?.name}`}
					</p>
					<nav
						aria-label="Car class"
						mix={[raw({ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBlock: "1rem" })]}
					>
						{CAR_CLASSES.map((car) => {
							let on = search.classes.includes(car.id);
							let classes = on
								? search.classes.filter((id) => id !== car.id)
								: [...search.classes, car.id];
							return (
								<a
									href={carsHref("cars", { ...search, classes })}
									aria-current={on ? "true" : undefined}
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											blockSize: "2.5rem",
											paddingInline: "1rem",
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
									{car.name}
								</a>
							);
						})}
						<a
							href={carsHref("cars", {
								...search,
								sort: search.sort === "price" ? "rating" : "price",
							})}
							mix={[
								raw({
									marginInlineStart: "auto",
									alignSelf: "center",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{search.sort === "price" ? "Sort by rating" : "Sort by price"}
						</a>
					</nav>
					<ol
						mix={[
							raw({ display: "grid", gap: "1rem", margin: "0", padding: "0", listStyle: "none" }),
						]}
					>
						{offers.map((offer) => (
							<li>
								<Offer offer={offer} search={search} today={today} />
							</li>
						))}
					</ol>
				</Page>
			</div>
		);
	};
}

/** Reads the extras a form or address picked. */
function readExtras(params: URLSearchParams): CarExtra[] {
	return params
		.getAll("extra")
		.filter((id): id is CarExtra => CAR_EXTRAS.some((extra) => extra.id === id));
}

/**
 * One offer's checkout: the car, the extras (a GET form that re-prices on Update), the price,
 * and a saved card to book with.
 */
export function CarCheckout(handle: Handle<{ ctx: Screen; offer: CarOfferData }>) {
	return () => {
		let { ctx, offer } = handle.props;
		let search = readCarSearch(ctx.url.searchParams, readDay);
		let extras = readExtras(ctx.url.searchParams);
		let window = rentalWindow(search, ctx.today);
		let quote = carQuote(
			offer,
			window.pickup,
			window.dropoff,
			extras,
			search.dropoff !== search.place,
		);
		let hidden = [
			...new URLSearchParams(
				writeCarSearch({ ...search, pickupDay: window.pickupDay, dropoffDay: window.dropoffDay }),
			),
		].filter(([name]) => name !== "class" && name !== "sort");
		return (
			<Page narrow>
				<a
					href={carsHref("cars", search)}
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
					Back to cars
				</a>
				<Title>
					{offer.car.name} from {offer.company.name}
				</Title>
				<div
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
					<div mix={[raw({ display: "grid", gap: "1.5rem" })]}>
						<div mix={[raw({ maxInlineSize: "22rem" })]}>
							<CarArt car={offer.car} />
						</div>
						<p mix={[raw({ margin: "0", lineHeight: "1.55" })]}>
							Pick up at {findRentalPlace(search.place)?.name} on{" "}
							{formatDay(window.pickupDay, { weekday: true })} at {search.pickupTime}. Return to{" "}
							{findRentalPlace(search.dropoff)?.name} on{" "}
							{formatDay(window.dropoffDay, { weekday: true })} by {search.dropoffTime}.
						</p>
						<form method="get" action={href(`cars/${offer.id}`)} aria-label="Extras">
							{hidden.map(([name, value]) => (
								<input type="hidden" name={name} value={value} />
							))}
							<fieldset
								mix={[
									raw({
										display: "grid",
										gap: "0.75rem",
										margin: "0",
										padding: "1rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-radius-lg)",
									}),
								]}
							>
								<legend mix={[raw({ paddingInline: "0.25rem", fontWeight: "650" })]}>Extras</legend>
								{CAR_EXTRAS.map((extra) => (
									<Checkbox
										name="extra"
										value={extra.id}
										defaultChecked={extras.includes(extra.id)}
									>
										{extra.label} · {money(extra.daily)} a day
									</Checkbox>
								))}
								<button
									type="submit"
									mix={[
										raw({
											justifySelf: "start",
											minBlockSize: "2.75rem",
											paddingInline: "1rem",
											border: "1px solid var(--ui-neutral-fg-emphasis)",
											borderRadius: "var(--ui-radius-md)",
											background: "var(--ui-bg)",
											font: "inherit",
											fontWeight: "600",
											cursor: "pointer",
										}),
									]}
								>
									Update price
								</button>
							</fieldset>
						</form>
						<form
							method="post"
							action={actionHref(`cars/${offer.id}/book`)}
							data-main-scroll-top=""
							mix={[raw({ display: "grid", gap: "1rem" })]}
						>
							{hidden.map(([name, value]) => (
								<input type="hidden" name={name} value={value} />
							))}
							{extras.map((extra) => (
								<input type="hidden" name="extra" value={extra} />
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
										{`${card.brand} ending in ${card.last4}`}
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
								Book for {money(quote.total)}
							</button>
						</form>
					</div>
					<aside
						aria-label="Price"
						mix={[
							raw({
								padding: "1.25rem",
								borderRadius: "1rem",
								boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						<PriceBreakdown
							note={
								offer.freeCancel
									? "Free cancellation until pickup."
									: "Paid at booking, refundable minus one day."
							}
						>
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
				</div>
			</Page>
		);
	};
}

/** Finds the offer a `cars/:offer` path names at the search's pickup place. */
export function offerFor(id: string, params: URLSearchParams): CarOfferData | undefined {
	return findCarOffer(readCarSearch(params, readDay).place, id);
}
