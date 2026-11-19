/**
 * Wayfern's home: the search front and centre over a drawn coastline, the six places as cards
 * to start from, a weekend that is still free, and the stays guests rate highest. Every card is
 * a link into a search or a listing, already carrying dates where it suggests some.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { Screen } from "./screen";

import { photoSrc } from "./art";
import { PLACES, STAYS, href } from "./data";
import { addDays, formatRange, weekday } from "./days";
import { GUTTER, MEASURE, WIDE } from "./layout";
import { NightlyPrice, StayCard, TotalPrice } from "./parts";
import { isBooked, quote } from "./pricing";
import { readSearch, tripQuery, withQuery } from "./query";
import { SearchForm, SearchPill } from "./search";

/** A home section: a heading with an optional link to see more, then its cards. */
function Section(
	handle: Handle<{
		id: string;
		title: string;
		lede?: string;
		more?: { href: string; label: string };
		children: RemixNode;
	}>,
) {
	return () => {
		let { children, id, lede, more, title } = handle.props;
		return (
			<section
				aria-labelledby={id}
				mix={[
					raw({
						maxInlineSize: MEASURE,
						marginInline: "auto",
						paddingInline: GUTTER,
						marginBlockStart: "clamp(2.5rem, 5vw, 4rem)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "end",
							justifyContent: "space-between",
							gap: "1rem",
							marginBlockEnd: "1.25rem",
						}),
					]}
				>
					<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
						<h2
							id={id}
							mix={[
								raw({
									margin: "0",
									fontFamily: "var(--ui-font-serif)",
									fontSize: "clamp(1.375rem, 1.1rem + 0.9vw, 1.75rem)",
									fontWeight: "600",
									letterSpacing: "-0.01em",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{title}
						</h2>
						{lede === undefined ? null : (
							<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>{lede}</p>
						)}
					</div>
					{more === undefined ? null : (
						<a
							href={more.href}
							data-rmx-prefetch="intent"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									flexShrink: "0",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "underline",
									textUnderlineOffset: "3px",
								}),
							]}
						>
							{more.label}
							<ArrowRightIcon aria-hidden="true" size={16} />
						</a>
					)}
				</div>
				{children}
			</section>
		);
	};
}

/** The grid every row of stay cards on home sits in, wrapping from four columns to one. */
function CardGrid(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))",
					gap: "2rem 1.5rem",
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

/** The Friday on or after today, which "a weekend away" starts on. */
function nextFriday(today: string): string {
	let gap = (5 - weekday(today) + 7) % 7;
	return addDays(today, gap === 0 ? 7 : gap);
}

namespace Home {
	export interface Props {
		ctx: Screen;
	}
}

/** The home screen. */
export default function Home(handle: Handle<Home.Props>) {
	return () => {
		let { back, base, today, traveller, url } = handle.props.ctx;
		let search = readSearch(url.searchParams);
		let friday = nextFriday(today);
		let sunday = addDays(friday, 2);
		let weekend = { start: friday, end: sunday, adults: 2, children: 0 };
		let freeThisWeekend = STAYS.filter(
			(stay) => !isBooked(stay, friday) && !isBooked(stay, addDays(friday, 1)),
		)
			.filter((stay) => stay.minNights <= 2)
			.slice(0, 4);
		let favourites = STAYS.filter((stay) => stay.favourite === true)
			.sort((a, b) => b.rating - a.rating)
			.slice(0, 8);
		return (
			<>
				<section
					aria-labelledby="wayfern-hero"
					mix={[
						raw({
							position: "relative",
							isolation: "isolate",
							overflow: "clip",
							paddingInline: GUTTER,
							paddingBlock: "clamp(2.5rem, 7vw, 5.5rem) clamp(2rem, 6vw, 4.5rem)",
							background:
								"linear-gradient(180deg, var(--ui-color-brand-50), color-mix(in oklch, var(--ui-color-brand-100), var(--ui-bg) 55%))",
						}),
					]}
				>
					<HeroHills />
					<div
						mix={[
							raw({
								position: "relative",
								maxInlineSize: "54rem",
								marginInline: "auto",
								display: "grid",
								gap: "1.25rem",
								justifyItems: "center",
								textAlign: "center",
							}),
						]}
					>
						<p
							mix={[
								raw({
									margin: "0",
									fontSize: "0.875rem",
									fontWeight: "650",
									letterSpacing: "0.08em",
									textTransform: "uppercase",
									color: "var(--ui-brand-fg)",
								}),
							]}
						>
							Stays along the Lowmere coast and hills
						</p>
						<h1
							id="wayfern-hero"
							mix={[
								raw({
									margin: "0",
									fontFamily: "var(--ui-font-serif)",
									fontSize: "clamp(2.125rem, 1.4rem + 3.2vw, 4rem)",
									fontWeight: "600",
									lineHeight: "1.04",
									letterSpacing: "-0.025em",
									color: "var(--ui-neutral-fg-emphasis)",
									textWrap: "balance",
								}),
							]}
						>
							Somewhere quieter, booked in a minute
						</h1>
						<p
							mix={[
								raw({
									margin: "0",
									maxInlineSize: "34rem",
									fontSize: "1.0625rem",
									lineHeight: "1.5",
									color: "var(--ui-neutral-fg)",
									textWrap: "pretty",
								}),
							]}
						>
							Cabins in the pines, boathouses on still lakes and lofts above market squares, each
							kept by someone who lives nearby.
						</p>
						<div
							mix={[
								raw({
									display: "none",
									inlineSize: "100%",
									justifyContent: "center",
									marginBlockStart: "0.75rem",
									[`@media ${WIDE}`]: { display: "flex" },
								}),
							]}
						>
							<SearchForm search={search} today={today} layout="bar" id="hero" base={base} />
						</div>
						<div
							mix={[
								raw({
									display: "flex",
									inlineSize: "100%",
									justifyContent: "center",
									marginBlockStart: "0.5rem",
									[`@media ${WIDE}`]: { display: "none" },
								}),
							]}
						>
							<SearchPill search={search} />
						</div>
					</div>
				</section>

				<Section
					id="wayfern-places"
					title="Where to go"
					lede="Six places, three hours apart at most."
				>
					<ul
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr))",
								gap: "1rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
								"& > li": { minInlineSize: "0" },
							}),
						]}
					>
						{PLACES.map((place) => {
							let stays = STAYS.filter((stay) => stay.place === place.id);
							let cover = stays[0]!;
							return (
								<li>
									<a
										href={href(`s?where=${place.id}`)}
										data-rmx-prefetch="intent"
										mix={[
											raw({
												display: "grid",
												gap: "0.625rem",
												color: "inherit",
												textDecoration: "none",
												"& img": { transition: "scale 400ms cubic-bezier(0.2, 0.7, 0.2, 1)" },
											}),
											when("&:hover img", raw({ scale: "1.04" })),
											when(
												"&:focus-visible",
												raw({
													outline: "2px solid var(--ui-brand-ring)",
													outlineOffset: "4px",
													borderRadius: "var(--ui-radius-lg)",
												}),
											),
											motionReduce(
												raw({ "& img": { transition: "none" }, "&:hover img": { scale: "1" } }),
											),
										]}
									>
										<span
											mix={[
												raw({
													display: "block",
													aspectRatio: "4 / 3",
													overflow: "clip",
													borderRadius: "var(--ui-radius-lg)",
													backgroundColor: cover.palette.sky,
												}),
											]}
										>
											<img
												src={photoSrc(cover, place.motif === "town" ? "outside" : "view")}
												alt=""
												width="600"
												height="400"
												loading="lazy"
												mix={[
													raw({
														display: "block",
														inlineSize: "100%",
														blockSize: "100%",
														objectFit: "cover",
													}),
												]}
											/>
										</span>
										<span mix={[raw({ display: "grid", gap: "0.125rem" })]}>
											<strong
												mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}
											>
												{place.name}
											</strong>
											<span
												mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
											>
												{stays.length} stays · {place.blurb.toLowerCase()}
											</span>
										</span>
									</a>
								</li>
							);
						})}
					</ul>
				</Section>

				<Section
					id="wayfern-weekend"
					title="Still free this weekend"
					lede={`${formatRange(friday, sunday)} · two nights for two`}
					more={{ href: href(withQuery("s", tripQuery(weekend))), label: "See all" }}
				>
					<CardGrid>
						{freeThisWeekend.map((stay) => {
							let price = quote(stay, friday, sunday);
							return (
								<StayCard
									stay={stay}
									query={tripQuery(weekend)}
									saved={traveller.saved.includes(stay.id)}
									back={back}
									price={<TotalPrice total={price.total} nights={price.nights} />}
									note={formatRange(friday, sunday)}
								/>
							);
						})}
					</CardGrid>
				</Section>

				<Section
					id="wayfern-favourites"
					title="Guest favourites"
					lede="The stays guests rate highest, and come back to."
					more={{ href: href("s?sort=rating"), label: "Top rated" }}
				>
					<CardGrid>
						{favourites.map((stay, index) => (
							<StayCard
								stay={stay}
								query=""
								saved={traveller.saved.includes(stay.id)}
								back={back}
								price={<NightlyPrice cents={stay.nightly} />}
								eager={index < 4}
							/>
						))}
					</CardGrid>
				</Section>
			</>
		);
	};
}

/** Soft hills along the hero's foot, drawn in the brand's tints, so the search sits on a landscape. */
function HeroHills() {
	return () => (
		<svg
			aria-hidden="true"
			viewBox="0 0 1200 220"
			preserveAspectRatio="none"
			mix={[
				raw({
					position: "absolute",
					insetInline: "0",
					insetBlockEnd: "0",
					zIndex: "-1",
					inlineSize: "100%",
					blockSize: "clamp(6rem, 18vw, 13rem)",
				}),
			]}
		>
			<path
				d="M0 120 C 180 60 320 90 480 110 S 820 40 1000 80 S 1150 110 1200 90 V220 H0Z"
				fill="var(--ui-color-brand-100)"
				opacity="0.8"
			/>
			<path
				d="M0 170 C 220 120 420 160 640 150 S 980 110 1200 150 V220 H0Z"
				fill="var(--ui-color-brand-200)"
				opacity="0.55"
			/>
			<path d="M0 200 C 300 180 600 210 900 195 S 1120 190 1200 200 V220 H0Z" fill="var(--ui-bg)" />
		</svg>
	);
}
