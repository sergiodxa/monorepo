/**
 * A stay's listing: its photos in a mosaic that opens a full-screen viewer, what it offers,
 * where it is, who hosts it, what guests said, when it is free, and a booking card that prices
 * the dates and party in the address. Picking dates reloads the page with them, so the price
 * follows every change, with or without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	AwardIcon,
	BathIcon,
	BedDoubleIcon,
	BikeIcon,
	CarIcon,
	ChevronLeftIcon,
	CookingPotIcon,
	FlameIcon,
	Grid2x2Icon,
	KeyRoundIcon,
	LaptopIcon,
	MedalIcon,
	PawPrintIcon,
	PlugZapIcon,
	SailboatIcon,
	SunIcon,
	ThermometerIcon,
	UsersIcon,
	WashingMachineIcon,
	WifiIcon,
	BabyIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Dialog, HeadingScope } from "@sdxc/ui";
import { Lightbox } from "@sdxc/ui/lightbox";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";
import { RangeMonths } from "@sdxc/ui/range-months";
import { RatingBreakdown } from "@sdxc/ui/travel/rating-breakdown";

import type { Amenity, Stay } from "./data";
import type { Screen } from "./screen";

import { photoSrc } from "./art";
import {
	AMENITIES,
	PHOTO_CAPTIONS,
	PHOTO_KINDS,
	categoryScores,
	hostOf,
	href,
	placeOf,
	reviewsFor,
	starShares,
	typeLabel,
} from "./data";
import { DatesField } from "./dates-field";
import { addDays, formatRange, nightsBetween } from "./days";
import { GuestsField } from "./guests-field";
import { GUTTER, MEASURE, TOP_BAR, WIDE } from "./layout";
import { HostFace, Rating, SaveButton, photoCaption } from "./parts";
import { BOOKING_HORIZON_DAYS, checkRequest, isBooked, money, nightPrice, quote } from "./pricing";
import { readSearch, tripQuery, withQuery } from "./query";
import { StaysMap } from "./results";
import { heldNights } from "./state";

/** The icon each amenity is listed with. */
const AMENITY_ICONS: Record<Amenity, typeof WifiIcon> = {
	wifi: WifiIcon,
	kitchen: CookingPotIcon,
	parking: CarIcon,
	fireplace: FlameIcon,
	"hot-tub": ThermometerIcon,
	sauna: ThermometerIcon,
	washer: WashingMachineIcon,
	workspace: LaptopIcon,
	pets: PawPrintIcon,
	ev: PlugZapIcon,
	water: SailboatIcon,
	bikes: BikeIcon,
	crib: BabyIcon,
	"self-check-in": KeyRoundIcon,
};

/** The icon each highlight is drawn with. */
const HIGHLIGHT_ICONS = {
	key: KeyRoundIcon,
	flame: FlameIcon,
	medal: MedalIcon,
	paw: PawPrintIcon,
	sun: SunIcon,
	laptop: LaptopIcon,
} as const;

/** The id of the photo viewer the mosaic opens. */
const PHOTOS = "wayfern-photos";

/** The id of the dialog listing every amenity. */
const AMENITIES_DIALOG = "wayfern-amenities-all";

/** How many amenities the listing shows before "Show all". */
const AMENITY_PREVIEW = 8;

/** A listing section: a rule above, a heading, then its content. */
function Block(
	handle: Handle<{ id: string; title: string; children: RemixNode; lede?: RemixNode }>,
) {
	return () => (
		<section
			id={handle.props.id}
			aria-labelledby={`${handle.props.id}-title`}
			mix={[
				raw({
					paddingBlock: "2rem",
					borderBlockStart: "1px solid var(--ui-neutral-border)",
					scrollMarginBlockStart: TOP_BAR,
				}),
			]}
		>
			<h2
				id={`${handle.props.id}-title`}
				mix={[
					raw({
						margin: "0 0 0.375rem",
						fontSize: "1.375rem",
						fontWeight: "650",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{handle.props.title}
			</h2>
			{handle.props.lede === undefined ? null : (
				<p mix={[raw({ margin: "0 0 1.25rem", color: "var(--ui-neutral-fg-muted)" })]}>
					{handle.props.lede}
				</p>
			)}
			<div mix={[raw({ marginBlockStart: handle.props.lede === undefined ? "1.25rem" : "0" })]}>
				{handle.props.children}
			</div>
		</section>
	);
}

/**
 * The photos: a large cover and four more in a mosaic on a wide screen, the cover alone with
 * a count on a phone. Each opens the viewer at itself; "Show all photos" opens it at the start.
 */
function Gallery(handle: Handle<{ stay: Stay; initial?: number }>) {
	return () => {
		let { initial, stay } = handle.props;
		let photos = PHOTO_KINDS.map((kind) => ({
			src: photoSrc(stay, kind),
			alt: photoCaption(stay, kind),
			caption: PHOTO_CAPTIONS[kind],
		}));
		return (
			<div mix={[raw({ position: "relative" })]}>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1fr",
							gap: "0.5rem",
							overflow: "clip",
							marginInline: `calc(-1 * ${GUTTER})`,
							aspectRatio: "3 / 2",
							[`@media ${WIDE}`]: {
								marginInline: "0",
								aspectRatio: "auto",
								blockSize: "clamp(20rem, 38vw, 30rem)",
								gridTemplateColumns: "2fr 1fr 1fr",
								gridTemplateRows: "1fr 1fr",
								borderRadius: "1rem",
							},
						}),
					]}
				>
					{PHOTO_KINDS.slice(0, 5).map((kind, index) => (
						<Lightbox.Trigger
							lightbox={PHOTOS}
							index={index}
							aria-label={`Open photo ${index + 1} of ${PHOTO_KINDS.length}: ${PHOTO_CAPTIONS[kind]}`}
							mix={[
								raw({
									display: index === 0 ? "block" : "none",
									padding: "0",
									border: "0",
									overflow: "clip",
									cursor: "zoom-in",
									backgroundColor: stay.palette.sky,
									gridRow: index === 0 ? "span 2" : "auto",
									[`@media ${WIDE}`]: { display: "block" },
									"& img": { transition: "filter 160ms ease" },
								}),
								when("&:hover img", raw({ filter: "brightness(0.92)" })),
							]}
						>
							<img
								src={photoSrc(stay, kind)}
								alt=""
								width="600"
								height="400"
								loading={index === 0 ? "eager" : "lazy"}
								mix={[
									raw({
										display: "block",
										inlineSize: "100%",
										blockSize: "100%",
										objectFit: "cover",
									}),
								]}
							/>
						</Lightbox.Trigger>
					))}
				</div>
				<Lightbox.Trigger
					lightbox={PHOTOS}
					index={0}
					mix={[
						raw({
							position: "absolute",
							insetBlockEnd: "1rem",
							insetInlineEnd: "1rem",
							display: "inline-flex",
							alignItems: "center",
							gap: "0.5rem",
							blockSize: "2.5rem",
							paddingInline: "0.875rem",
							border: "1px solid var(--ui-neutral-fg-emphasis)",
							borderRadius: "var(--ui-radius-md)",
							backgroundColor: "var(--ui-bg)",
							color: "var(--ui-neutral-fg-emphasis)",
							fontSize: "0.875rem",
							fontWeight: "600",
							cursor: "pointer",
						}),
					]}
				>
					<Grid2x2Icon aria-hidden="true" size={16} />
					<span mix={[raw({ display: "none", [`@media ${WIDE}`]: { display: "inline" } })]}>
						Show all photos
					</span>
					<span mix={[raw({ [`@media ${WIDE}`]: { display: "none" } })]}>
						1 / {PHOTO_KINDS.length}
					</span>
				</Lightbox.Trigger>
				<Lightbox id={PHOTOS} label={`Photos of ${stay.name}`} photos={photos} initial={initial} />
			</div>
		);
	};
}

/** The amenities a stay lists, each with its icon, in the app's amenity order. */
function AmenityList(handle: Handle<{ amenities: Amenity[] }>) {
	return () => (
		<ul
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
					gap: "1rem 1.5rem",
					margin: "0",
					padding: "0",
					listStyle: "none",
				}),
			]}
		>
			{AMENITIES.filter((amenity) => handle.props.amenities.includes(amenity.id)).map((amenity) => {
				let Icon = AMENITY_ICONS[amenity.id];
				return (
					<li
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.875rem",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						<Icon
							aria-hidden="true"
							size={22}
							mix={[raw({ flexShrink: "0", color: "var(--ui-neutral-fg)" })]}
						/>
						{amenity.label}
					</li>
				);
			})}
		</ul>
	);
}

namespace BookingCard {
	export interface Props {
		stay: Stay;
		ctx: Screen;
	}
}

/**
 * The booking card: the price, the dates and party as a GET form to this page, so changing
 * any of them re-prices the stay, and Reserve, which takes the same fields to checkout. A
 * problem with the request is named under the fields with what to change.
 */
function BookingCard(handle: Handle<BookingCard.Props>) {
	return () => {
		let { ctx, stay } = handle.props;
		let search = readSearch(ctx.url.searchParams);
		let mine = heldNights(ctx.traveller, stay.id);
		let booked = bookedNights(stay, ctx.today, mine);
		let request = {
			start: search.start,
			end: search.end,
			adults: search.adults,
			children: search.children,
		};
		let dated = search.start !== undefined && search.end !== undefined;
		let problems = dated ? checkRequest(stay, request, ctx.today, mine) : [];
		let price =
			dated && problems.length === 0 ? quote(stay, search.start!, search.end!) : undefined;
		let box = raw({
			border: "1px solid var(--ui-neutral-border-strong, var(--ui-neutral-border))",
			borderRadius: "var(--ui-radius-lg)",
			overflow: "clip",
		});
		return (
			<form
				method="get"
				action={href(`stay/${stay.id}`)}
				id="wayfern-booking"
				aria-label={`Book ${stay.name}`}
				mix={[
					raw({
						display: "grid",
						gap: "1rem",
						padding: "1.5rem",
						borderRadius: "1rem",
						backgroundColor: "var(--ui-bg)",
						boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 12px 32px -12px rgb(0 0 0 / 0.22)",
					}),
				]}
			>
				<p
					mix={[
						raw({
							margin: "0",
							display: "flex",
							alignItems: "baseline",
							gap: "0.375rem",
							flexWrap: "wrap",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					<strong mix={[raw({ fontSize: "1.375rem", fontWeight: "650" })]}>
						{money(price?.average ?? stay.nightly)}
					</strong>
					<span>night</span>
					{price === undefined ? (
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							· weekends {money(Math.round((stay.nightly * 1.15) / 100) * 100)}
						</span>
					) : (
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							average
						</span>
					)}
				</p>
				<div mix={[box]}>
					<DatesField
						id="book"
						start={search.start}
						end={search.end}
						today={ctx.today}
						base={ctx.base}
						booked={booked}
						submitOnRange
						boxed
					/>
					<div mix={[raw({ borderBlockStart: "1px solid var(--ui-neutral-border)" })]}>
						<GuestsField
							id="book-guests"
							adults={search.adults}
							kids={search.children}
							max={stay.guests}
							boxed
						/>
					</div>
				</div>
				{problems.length > 0 ? (
					<ul
						role="alert"
						mix={[
							raw({
								margin: "0",
								padding: "0",
								listStyle: "none",
								display: "grid",
								gap: "0.25rem",
								fontSize: "0.875rem",
								color: "var(--ui-danger-fg)",
							}),
						]}
					>
						{problems.map((problem) => (
							<li>{problem.message}</li>
						))}
					</ul>
				) : null}
				{price === undefined ? (
					<button type="submit" mix={reserveStyle()}>
						Check availability
					</button>
				) : (
					<button type="submit" formaction={href(`book/${stay.id}`)} mix={reserveStyle()}>
						Reserve
					</button>
				)}
				{price === undefined ? (
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "0.875rem",
								textAlign: "center",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{dated
							? "Change the dates or guests to see a price."
							: `Pick dates to see the total. ${stay.minNights}-night minimum.`}
					</p>
				) : (
					<PriceBreakdown note="You won't be charged yet">
						{price.lines.map((line) => (
							<PriceBreakdown.Line
								label={line.key === "nights" ? (line.detail ?? line.label) : line.label}
								amount={money(Math.abs(line.cents))}
								tone={line.key === "discount" ? "discount" : undefined}
								name={line.key}
								line={line.key}
							/>
						))}
						<PriceBreakdown.Total
							label="Total before taxes and fees are final"
							amount={money(price.total)}
							name="total"
						/>
					</PriceBreakdown>
				)}
			</form>
		);
	};
}

/** The look of the card's main button: a full-width brand block. */
function reserveStyle() {
	return [
		raw({
			blockSize: "3.25rem",
			border: "0",
			borderRadius: "var(--ui-radius-lg)",
			backgroundColor: "var(--ui-brand-bg-solid)",
			color: "var(--ui-brand-fg-on-solid)",
			font: "inherit",
			fontSize: "1rem",
			fontWeight: "650",
			cursor: "pointer",
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-brand-bg-solid-hover)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}

/** Every booked night from today to the horizon, which calendars strike through. */
function bookedNights(stay: Stay, today: string, mine: ReadonlySet<string>): string[] {
	let nights: string[] = [];
	for (let offset = 0; offset < BOOKING_HORIZON_DAYS; offset++) {
		let day = addDays(today, offset);
		if (isBooked(stay, day, mine)) nights.push(day);
	}
	return nights;
}

/**
 * The phone's booking bar, pinned above the tab bar: the price for the dates in the address
 * and Reserve, or a link to the calendar while there are none.
 */
function PhoneBookBar(handle: Handle<{ stay: Stay; ctx: Screen }>) {
	return () => {
		let { ctx, stay } = handle.props;
		let search = readSearch(ctx.url.searchParams);
		let mine = heldNights(ctx.traveller, stay.id);
		let ok =
			search.start !== undefined &&
			search.end !== undefined &&
			checkRequest(stay, { ...search }, ctx.today, mine).length === 0;
		let price = ok ? quote(stay, search.start!, search.end!) : undefined;
		return (
			<div
				mix={[
					raw({
						position: "fixed",
						insetInline: "0",
						insetBlockEnd: "calc(4rem + env(safe-area-inset-bottom))",
						[`@media ${WIDE}`]: { insetBlockEnd: "0" },
						zIndex: "20",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "1rem",
						paddingInline: GUTTER,
						paddingBlock: "0.75rem",
						backgroundColor: "var(--ui-bg)",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"@media (min-width: 60rem)": { display: "none" },
					}),
				]}
			>
				<div mix={[raw({ display: "grid", lineHeight: "1.3" })]}>
					<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
						<strong>{money(price?.total ?? stay.nightly)}</strong>{" "}
						{price === undefined ? "night" : "total"}
					</span>
					<span
						mix={[
							raw({
								fontSize: "0.8125rem",
								color: "var(--ui-neutral-fg-muted)",
								textDecoration: "underline",
							}),
						]}
					>
						{price === undefined ? "Add dates" : formatRange(search.start!, search.end!)}
					</span>
				</div>
				<a
					href={
						price === undefined
							? "#availability"
							: href(withQuery(`book/${stay.id}`, tripQuery(search)))
					}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							blockSize: "3rem",
							paddingInline: "1.5rem",
							borderRadius: "var(--ui-radius-lg)",
							backgroundColor: "var(--ui-brand-bg-solid)",
							color: "var(--ui-brand-fg-on-solid)",
							fontWeight: "650",
							textDecoration: "none",
						}),
					]}
				>
					{price === undefined ? "Check dates" : "Reserve"}
				</a>
			</div>
		);
	};
}

/** The listing screen for one stay. */
export default function StayPage(handle: Handle<{ stay: Stay; ctx: Screen }>) {
	return () => {
		let { ctx, stay } = handle.props;
		let search = readSearch(ctx.url.searchParams);
		let host = hostOf(stay);
		let place = placeOf(stay);
		let mine = heldNights(ctx.traveller, stay.id);
		let photo = Number(ctx.url.searchParams.get("photo"));
		let calendarMonth =
			ctx.url.searchParams.get("month") ?? (search.start ?? ctx.today).slice(0, 7);
		let shares = starShares(stay);
		let reviews = reviewsFor(stay);
		let nights =
			search.start !== undefined && search.end !== undefined
				? nightsBetween(search.start, search.end)
				: 0;
		let resultsQuery = withQuery(
			"s",
			[`where=${place.id}`, tripQuery(search)].filter((part) => part !== "").join("&"),
		);
		return (
			<div
				mix={[
					raw({
						maxInlineSize: MEASURE,
						marginInline: "auto",
						paddingInline: GUTTER,
						paddingBlockStart: "1rem",
						paddingBlockEnd: "6rem",
						"@media (min-width: 60rem)": { paddingBlockEnd: "0" },
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "1rem",
							marginBlockEnd: "1rem",
						}),
					]}
				>
					<a
						href={href(resultsQuery)}
						data-rmx-prefetch="intent"
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
							when("&:hover", raw({ textDecoration: "underline" })),
						]}
					>
						<ChevronLeftIcon aria-hidden="true" size={18} />
						Stays in {place.name}
					</a>
					<SaveButton stay={stay} saved={ctx.traveller.saved.includes(stay.id)} back={ctx.back} />
				</div>
				<h1
					mix={[
						raw({
							margin: "0 0 1rem",
							fontFamily: "var(--ui-font-serif)",
							fontSize: "clamp(1.75rem, 1.3rem + 1.6vw, 2.5rem)",
							fontWeight: "600",
							lineHeight: "1.1",
							letterSpacing: "-0.015em",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{stay.name}
				</h1>
				<Gallery
					stay={stay}
					initial={
						Number.isInteger(photo) && photo >= 1 && photo <= PHOTO_KINDS.length ? photo : undefined
					}
				/>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "0 4rem",
							marginBlockStart: "1.5rem",
							"@media (min-width: 60rem)": { gridTemplateColumns: "minmax(0, 1fr) 23rem" },
						}),
					]}
				>
					<div>
						<div mix={[raw({ paddingBlockEnd: "1.5rem" })]}>
							<h2
								mix={[
									raw({
										margin: "0",
										fontSize: "1.375rem",
										fontWeight: "650",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{typeLabel(stay.type)} in {place.name}
							</h2>
							<p mix={[raw({ margin: "0.25rem 0 0.75rem", color: "var(--ui-neutral-fg)" })]}>
								{stay.guests} guests · {stay.bedrooms}{" "}
								{stay.bedrooms === 1 ? "bedroom" : "bedrooms"} · {stay.beds}{" "}
								{stay.beds === 1 ? "bed" : "beds"} · {stay.baths}{" "}
								{stay.baths === 1 ? "bath" : "baths"}
							</p>
							<p
								mix={[
									raw({
										margin: "0",
										display: "flex",
										alignItems: "center",
										gap: "0.75rem",
										flexWrap: "wrap",
									}),
								]}
							>
								<Rating rating={stay.rating} reviews={stay.reviews} />
								{stay.favourite === true ? (
									<span
										mix={[
											raw({
												display: "inline-flex",
												alignItems: "center",
												gap: "0.375rem",
												fontWeight: "600",
												color: "var(--ui-brand-fg-emphasis)",
											}),
										]}
									>
										<AwardIcon aria-hidden="true" size={16} />
										Guest favourite
									</span>
								) : null}
							</p>
						</div>
						<div
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "1rem",
									paddingBlock: "1.5rem",
									borderBlockStart: "1px solid var(--ui-neutral-border)",
								}),
							]}
						>
							<HostFace name={host.name} hues={host.hues} size={3} />
							<div>
								<p
									mix={[
										raw({ margin: "0", fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" }),
									]}
								>
									Hosted by {host.name.split(" ")[0]}
								</p>
								<p
									mix={[
										raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
									]}
								>
									{host.trusted ? "Hosts with care · " : ""}Hosting since {host.since}
								</p>
							</div>
						</div>
						<ul
							mix={[
								raw({
									display: "grid",
									gap: "1.25rem",
									margin: "0",
									padding: "1.5rem 0",
									listStyle: "none",
									borderBlockStart: "1px solid var(--ui-neutral-border)",
								}),
							]}
						>
							{stay.highlights.map((highlight) => {
								let Icon = HIGHLIGHT_ICONS[highlight.icon];
								return (
									<li
										mix={[
											raw({
												display: "grid",
												gridTemplateColumns: "auto 1fr",
												gap: "0 1.25rem",
												alignItems: "start",
											}),
										]}
									>
										<Icon
											aria-hidden="true"
											size={24}
											mix={[raw({ gridRow: "span 2", color: "var(--ui-neutral-fg-emphasis)" })]}
										/>
										<strong
											mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}
										>
											{highlight.title}
										</strong>
										<span
											mix={[raw({ fontSize: "0.9375rem", color: "var(--ui-neutral-fg-muted)" })]}
										>
											{highlight.text}
										</span>
									</li>
								);
							})}
						</ul>
						<Block id="about" title="About this place">
							<div
								mix={[
									raw({
										display: "grid",
										gap: "1rem",
										maxInlineSize: "40rem",
										lineHeight: "1.6",
										color: "var(--ui-neutral-fg)",
									}),
								]}
							>
								{stay.description.map((paragraph) => (
									<p mix={[raw({ margin: "0" })]}>{paragraph}</p>
								))}
							</div>
						</Block>
						<Block id="offers" title="What this place offers">
							<AmenityList amenities={stay.amenities.slice(0, AMENITY_PREVIEW)} />
							{stay.amenities.length > AMENITY_PREVIEW ? (
								<>
									<button
										type="button"
										commandfor={AMENITIES_DIALOG}
										command="show-modal"
										mix={[outlineButton(), raw({ marginBlockStart: "1.5rem" })]}
									>
										Show all {stay.amenities.length} amenities
									</button>
									<HeadingScope level={2}>
										<Dialog id={AMENITIES_DIALOG} aria-labelledby={`${AMENITIES_DIALOG}-title`}>
											<Dialog.Header>
												<Dialog.Title id={`${AMENITIES_DIALOG}-title`}>
													What this place offers
												</Dialog.Title>
											</Dialog.Header>
											<AmenityList amenities={stay.amenities} />
											<Dialog.Footer>
												<button
													type="button"
													commandfor={AMENITIES_DIALOG}
													command="close"
													mix={outlineButton()}
												>
													Close
												</button>
											</Dialog.Footer>
										</Dialog>
									</HeadingScope>
								</>
							) : null}
						</Block>
						<Block
							id="availability"
							title={
								nights > 0
									? `${nights} ${nights === 1 ? "night" : "nights"} in ${place.name}`
									: "When it's free"
							}
							lede={
								search.start !== undefined && search.end !== undefined
									? formatRange(search.start, search.end)
									: `Pick check-in, then check-out. ${stay.minNights}-night minimum.`
							}
						>
							<RangeMonths
								headingLevel={3}
								month={calendarMonth}
								months={2}
								start={search.start}
								end={search.end}
								today={ctx.today}
								min={ctx.today}
								max={addDays(ctx.today, BOOKING_HORIZON_DAYS)}
								locale="en-US"
								label={`Availability at ${stay.name}`}
								labels={{
									previous: "Previous month",
									next: "Next month",
									start: "check-in",
									end: "check-out",
								}}
								isUnavailable={(day) => isBooked(stay, day, mine)}
								dayNote={(day) =>
									isBooked(stay, day, mine) ? null : `$${Math.round(nightPrice(stay, day) / 100)}`
								}
								href={(next) => {
									let params = new URLSearchParams(
										tripQuery({ ...search, start: next.start, end: next.end }),
									);
									params.set("month", next.month);
									return href(`stay/${stay.id}?${params}`);
								}}
							/>
							{search.start !== undefined ? (
								<a
									href={href(
										withQuery(
											`stay/${stay.id}`,
											tripQuery({ ...search, start: undefined, end: undefined }),
										),
									)}
									mix={[
										raw({
											display: "inline-block",
											marginBlockStart: "1rem",
											fontWeight: "600",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									Clear dates
								</a>
							) : null}
						</Block>
					</div>
					<div mix={[raw({ display: "none", "@media (min-width: 60rem)": { display: "block" } })]}>
						<div
							mix={[
								raw({
									position: "sticky",
									insetBlockStart: `calc(${TOP_BAR} + 1.5rem)`,
									paddingBlockEnd: "2rem",
								}),
							]}
						>
							<BookingCard stay={stay} ctx={ctx} />
						</div>
					</div>
				</div>
				<Block id="reviews" title="What guests say">
					<div
						mix={[
							raw({
								display: "grid",
								gap: "2.5rem",
								gridTemplateColumns: "minmax(0, 1fr)",
								"@media (min-width: 60rem)": {
									gridTemplateColumns: "minmax(0, 20rem) minmax(0, 1fr)",
								},
							}),
						]}
					>
						<RatingBreakdown score={stay.rating} count={`${stay.reviews} reviews`}>
							<RatingBreakdown.Group kind="stars">
								{shares.map((share, index) => (
									<RatingBreakdown.Bar
										label={`${5 - index} stars`}
										value={share}
										display={`${Math.round(share * 100)}%`}
									/>
								))}
							</RatingBreakdown.Group>
							<RatingBreakdown.Group kind="categories">
								{categoryScores(stay).map((category) => (
									<RatingBreakdown.Bar
										label={category.label}
										value={category.score}
										display={category.score.toFixed(1)}
									/>
								))}
							</RatingBreakdown.Group>
						</RatingBreakdown>
						<div>
							<ul
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 18rem), 1fr))",
										gap: "2rem",
										margin: "0",
										padding: "0",
										listStyle: "none",
									}),
								]}
							>
								{reviews.map((review) => (
									<li>
										<figure mix={[raw({ margin: "0", display: "grid", gap: "0.75rem" })]}>
											<figcaption
												mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem" })]}
											>
												<HostFace
													name={review.author}
													hues={[review.hue, review.hue + 30]}
													size={2.75}
												/>
												<span mix={[raw({ display: "grid" })]}>
													<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
														{review.author}
													</strong>
													<span
														mix={[
															raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
														]}
													>
														{review.from} · {review.when} · {"★".repeat(review.rating)}
													</span>
												</span>
											</figcaption>
											<blockquote
												mix={[
													raw({ margin: "0", lineHeight: "1.55", color: "var(--ui-neutral-fg)" }),
												]}
											>
												{review.text}
											</blockquote>
										</figure>
									</li>
								))}
							</ul>
						</div>
					</div>
				</Block>
				<Block
					id="where"
					title="Where you'll be"
					lede={`${place.name} · the exact address arrives with your booking.`}
				>
					<div mix={[raw({ maxInlineSize: "56rem", overflow: "clip", borderRadius: "1rem" })]}>
						<StaysMap
							stays={[stay]}
							labels={new Map([[stay.id, typeLabel(stay.type)]])}
							query=""
							place={place.id}
							label={`${stay.name} on the map`}
							current={stay.id}
							linked={false}
						/>
					</div>
				</Block>
				<Block id="host" title={`Meet ${host.name.split(" ")[0]}`}>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "1.5rem",
								maxInlineSize: "44rem",
								gridTemplateColumns: "minmax(0, 1fr)",
								[`@media ${WIDE}`]: { gridTemplateColumns: "auto minmax(0, 1fr)" },
							}),
						]}
					>
						<div
							mix={[
								raw({
									display: "grid",
									justifyItems: "center",
									gap: "0.5rem",
									padding: "1.5rem 2rem",
									borderRadius: "1rem",
									boxShadow:
										"0 0 0 1px var(--ui-neutral-border), 0 8px 24px -14px rgb(0 0 0 / 0.3)",
									textAlign: "center",
								}),
							]}
						>
							<HostFace name={host.name} hues={host.hues} size={5} />
							<strong mix={[raw({ fontSize: "1.25rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
								{host.name}
							</strong>
							{host.trusted ? (
								<span
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											gap: "0.375rem",
											fontSize: "0.875rem",
											fontWeight: "600",
											color: "var(--ui-brand-fg-emphasis)",
										}),
									]}
								>
									<MedalIcon aria-hidden="true" size={16} />
									Hosts with care
								</span>
							) : null}
							<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
								Hosting since {host.since}
							</span>
						</div>
						<div
							mix={[
								raw({ display: "grid", gap: "0.75rem", alignContent: "start", lineHeight: "1.55" }),
							]}
						>
							<p mix={[raw({ margin: "0" })]}>{host.bio}</p>
							<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
								Responds {host.responds} · Speaks {host.languages.join(", ")}
							</p>
							<p
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
										margin: "0",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								<UsersIcon aria-hidden="true" size={16} />
								You can message {host.name.split(" ")[0]} once your stay is booked.
							</p>
						</div>
					</div>
				</Block>
				<p
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "1.5rem",
							flexWrap: "wrap",
							margin: "0",
							paddingBlock: "1.5rem",
							borderBlockStart: "1px solid var(--ui-neutral-border)",
							fontSize: "0.875rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
						<BedDoubleIcon aria-hidden="true" size={16} />
						Check-in after 3pm
					</span>
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
						<BathIcon aria-hidden="true" size={16} />
						Linens and towels included
					</span>
					<span>Free cancellation until 7 days before check-in</span>
				</p>
				<PhoneBookBar stay={stay} ctx={ctx} />
			</div>
		);
	};
}

/** A quiet bordered button, for secondary actions on the listing. */
function outlineButton() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			blockSize: "2.75rem",
			paddingInline: "1.25rem",
			border: "1px solid var(--ui-neutral-fg-emphasis)",
			borderRadius: "var(--ui-radius-md)",
			background: "var(--ui-bg)",
			color: "var(--ui-neutral-fg-emphasis)",
			font: "inherit",
			fontWeight: "600",
			cursor: "pointer",
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}
