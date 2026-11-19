/**
 * Wayfern's packages: return flights and a stay booked together for less. A search names the
 * home airport, the place and the dates; each stay is priced with the best flights to its
 * nearest airport, and the package screen shows both parts and what the bundle saves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronLeftIcon, ShieldCheckIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { PackageSavings } from "@sdxc/ui/travel/package-savings";

import type { Stay } from "./data";
import type { FlightOption } from "./flights";
import type { Screen } from "./screen";

import { SAVED_CARDS, STAYS, actionHref, href, placeOf } from "./data";
import { formatRange } from "./days";
import { findAirport, flightsOn } from "./flights";
import { AirlineMark, primaryButton } from "./flights-view";
import { GUTTER } from "./layout";
import { NightlyPrice, Page, StayCard, Title } from "./parts";
import { checkRequest, money, quote } from "./pricing";
import { readSearch, tripQuery } from "./query";
import { heldNights } from "./state";
import { flightQuote, packageSaving } from "./travel-pricing";
import { PackageSearchForm } from "./travel-search";

/** The airport nearest each place, which a package flies into. */
const NEAREST_AIRPORT: Record<string, string> = {
	"ponta-delgada": "MRW",
	"ribeira-grande": "MRW",
	"sete-cidades": "MRW",
	"vila-franca": "VLS",
	furnas: "VLS",
	nordeste: "VLS",
};

/** One priced package: a stay with the cheapest flights there and back for the dates. */
export interface PackageDeal {
	stay: Stay;
	out: FlightOption;
	back: FlightOption;
	/** The stay and the flights booked apart, in US cents. */
	separately: number;
	saving: number;
	stayCost: number;
	flightCost: number;
}

/** The home airport a package search names, New York when it names none it knows. */
export function originOf(params: URLSearchParams): string {
	let origin = findAirport(params.get("origin") ?? "");
	return origin === undefined || origin.place !== undefined ? "SRL" : origin.code;
}

/**
 * Prices one stay as a package for a search's dates and party, or `undefined` when the stay or
 * either flight can't be had.
 *
 * @param stay The stay.
 * @param origin The home airport.
 * @param search The dates and party.
 * @param today Today's key.
 * @param mine Nights the visitor already holds at the stay.
 */
export function dealFor(
	stay: Stay,
	origin: string,
	search: ReturnType<typeof readSearch>,
	today: string,
	mine: ReadonlySet<string> = new Set(),
): PackageDeal | undefined {
	if (search.start === undefined || search.end === undefined) return undefined;
	if (checkRequest(stay, search, today, mine).length > 0) return undefined;
	let airport = NEAREST_AIRPORT[stay.place] ?? "MRW";
	let cheapest = (options: FlightOption[]) =>
		options.reduce<FlightOption | undefined>(
			(best, option) => (best === undefined || option.price < best.price ? option : best),
			undefined,
		);
	let out = cheapest(flightsOn(origin, airport, search.start));
	let back = cheapest(flightsOn(airport, origin, search.end));
	if (out === undefined || back === undefined) return undefined;
	let stayCost = quote(stay, search.start, search.end).total;
	let flightCost = flightQuote(
		[
			{ option: out, fare: "standard", seatFees: 0 },
			{ option: back, fare: "standard", seatFees: 0 },
		],
		search.adults,
		search.children,
	).total;
	let separately = stayCost + flightCost;
	return { stay, out, back, separately, saving: packageSaving(separately), stayCost, flightCost };
}

/** The packages screen: the search, then each stay in the place priced as a package. */
export default function PackagesPage(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let { back, base, today, traveller, url } = handle.props.ctx;
		let search = readSearch(url.searchParams);
		let origin = originOf(url.searchParams);
		let deals = STAYS.filter((stay) => search.place === undefined || stay.place === search.place)
			.map((stay) => dealFor(stay, origin, search, today, heldNights(traveller, stay.id)))
			.filter((deal): deal is PackageDeal => deal !== undefined)
			.sort((a, b) => a.separately - a.saving - (b.separately - b.saving));
		let packageQuery = `${tripQuery(search)}&origin=${origin}`;
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
						<PackageSearchForm
							search={search}
							origin={origin}
							today={today}
							base={base}
							layout="bar"
							id="packages"
						/>
					</div>
				</div>
				<Page>
					<Title>Flight and stay packages</Title>
					<p mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
						{search.start === undefined || search.end === undefined
							? "Pick dates to see packages: return flights and a stay booked together cost 12% less."
							: `From ${findAirport(origin)!.city} · ${formatRange(search.start, search.end)} · ${deals.length} packages`}
					</p>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 16rem), 1fr))",
								gap: "2rem 1.5rem",
								marginBlockStart: "1.5rem",
							}),
						]}
					>
						{search.start === undefined
							? STAYS.filter((stay) => stay.favourite === true).map((stay) => (
									<StayCard
										stay={stay}
										query=""
										saved={traveller.saved.includes(stay.id)}
										back={back}
										price={<NightlyPrice cents={stay.nightly} />}
									/>
								))
							: deals.map((deal) => (
									<StayCard
										stay={deal.stay}
										query={packageQuery}
										href={href(`packages/${deal.stay.id}?${packageQuery}`)}
										saved={traveller.saved.includes(deal.stay.id)}
										back={back}
										note={`Flights + ${placeOf(deal.stay).name} · save ${money(deal.saving)}`}
										price={
											<>
												<strong>{money(deal.separately - deal.saving)}</strong> package{" "}
												<s mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
													{money(deal.separately)}
												</s>
											</>
										}
									/>
								))}
					</div>
				</Page>
			</div>
		);
	};
}

/** One package: the flights and the stay side by side, what they save, and booking. */
export function PackagePage(handle: Handle<{ ctx: Screen; deal: PackageDeal }>) {
	return () => {
		let { ctx, deal } = handle.props;
		let search = readSearch(ctx.url.searchParams);
		let origin = originOf(ctx.url.searchParams);
		let out = deal.out.segments[0]!;
		let backLeg = deal.back.segments[0]!;
		return (
			<Page narrow>
				<a
					href={href(
						`packages?${tripQuery(search)}&origin=${origin}${search.place === undefined ? "" : `&where=${search.place}`}`,
					)}
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
					All packages
				</a>
				<Title>
					{deal.stay.name} with flights from {findAirport(origin)!.city}
				</Title>
				<div mix={[raw({ display: "grid", gap: "1.5rem", marginBlockStart: "1.5rem" })]}>
					<PackageSavings
						title="Your package"
						savings={`You save ${money(deal.saving)}`}
						bundleLabel="Package price"
						bundlePrice={money(deal.separately - deal.saving)}
						bundleDetail={`${search.adults + search.children} travellers · taxes included`}
						separateTotal={money(deal.separately)}
						separateLabel="Booked separately"
					>
						<PackageSavings.Part
							kind="flight"
							icon={<AirlineMark code={out.airline} size={1.5} />}
							label={`Return flights ${out.from} ⇄ ${deal.out.segments.at(-1)!.to}`}
							detail={`${out.flight} out · ${backLeg.flight} back · Standard fare`}
							price={money(deal.flightCost)}
						/>
						<PackageSavings.Part
							kind="stay"
							label={`${deal.stay.name}, ${placeOf(deal.stay).name}`}
							detail={formatRange(search.start!, search.end!)}
							price={money(deal.stayCost)}
						/>
					</PackageSavings>
					<form
						method="post"
						action={actionHref(`packages/${deal.stay.id}/book`)}
						data-main-scroll-top=""
						mix={[raw({ display: "grid", gap: "1rem" })]}
					>
						{[...new URLSearchParams(`${tripQuery(search)}&origin=${origin}`)].map(
							([name, value]) => (
								<input type="hidden" name={name} value={value} />
							),
						)}
						<input type="hidden" name="out" value={deal.out.id} />
						<input type="hidden" name="back" value={deal.back.id} />
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
							Book the package for {money(deal.separately - deal.saving)}
						</button>
					</form>
				</div>
			</Page>
		);
	};
}
