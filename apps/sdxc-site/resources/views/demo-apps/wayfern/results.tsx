/**
 * Search results: the stays a search finds beside a drawn map of where they are, with the
 * price on every pin. Each filter (type, price, amenities, sort) lives in the address, so a
 * list is a link someone can send; on a phone the list and map share the screen by a toggle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CheckIcon,
	ChevronDownIcon,
	ListIcon,
	MapIcon,
	SlidersHorizontalIcon,
	XIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Checkbox, Popover, HeadingScope } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

import type { Search, StayResults } from "./query";
import type { Screen } from "./screen";

import { AMENITIES, FILTER_AMENITIES, STAY_TYPES, findPlace, href } from "./data";
import { formatRange } from "./days";
import { GUTTER, SPLIT, TOP_BAR } from "./layout";
import { NightlyPrice, StayCard, TotalPrice } from "./parts";
import { money, quote } from "./pricing";
import {
	PRICE_BOUNDS,
	SORTS,
	filterCount,
	searchStays,
	readSearch,
	tripQuery,
	withQuery,
	writeSearch,
} from "./query";
import { AREA_FORM, StaysMap } from "./stays-map";

/** The results page address for a search. */
function resultsHref(search: Search): string {
	return href(withQuery("s", writeSearch(search)));
}

/** A filter chip's look: a pill that fills dark when on. */
function chipStyle() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			flexShrink: "0",
			blockSize: "2.5rem",
			paddingInline: "1rem",
			border: "1px solid var(--ui-neutral-border)",
			borderRadius: "999px",
			background: "var(--ui-bg)",
			color: "var(--ui-neutral-fg-emphasis)",
			font: "inherit",
			fontSize: "0.875rem",
			fontWeight: "550",
			whiteSpace: "nowrap",
			textDecoration: "none",
			cursor: "pointer",
			"&[data-on]": {
				borderColor: "var(--ui-neutral-fg-emphasis)",
				backgroundColor: "var(--ui-neutral-bg-tint)",
				boxShadow: "inset 0 0 0 1px var(--ui-neutral-fg-emphasis)",
			},
		}),
		when("&:hover", raw({ borderColor: "var(--ui-neutral-fg-emphasis)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}

/** Hidden fields carrying every part of a search a filter form doesn't edit itself. */
function Kept(handle: Handle<{ search: Search; omit: Array<"price" | "amenity"> }>) {
	return () => {
		let { omit, search } = handle.props;
		let params = new URLSearchParams(writeSearch(search));
		if (omit.includes("price")) {
			params.delete("min");
			params.delete("max");
		}
		if (omit.includes("amenity")) params.delete("amenity");
		return (
			<>
				{[...params].map(([name, value]) => (
					<input type="hidden" name={name} value={value} />
				))}
			</>
		);
	};
}

/** The surface a filter's panel opens on. */
function panelStyle() {
	return raw({
		inlineSize: "min(22rem, calc(100vw - 1rem))",
		padding: "1.25rem",
		borderRadius: "1.25rem",
	});
}

/** A panel's apply and clear row. */
function PanelActions(handle: Handle<{ clear: string }>) {
	return () => (
		<div
			mix={[
				raw({
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBlockStart: "1.25rem",
				}),
			]}
		>
			<a
				href={handle.props.clear}
				mix={[
					raw({ fontSize: "0.875rem", fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" }),
				]}
			>
				Clear
			</a>
			<button
				type="submit"
				mix={[
					raw({
						blockSize: "2.5rem",
						paddingInline: "1.125rem",
						border: "0",
						borderRadius: "var(--ui-radius-md)",
						backgroundColor: "var(--ui-neutral-bg-solid)",
						color: "var(--ui-neutral-fg-on-solid)",
						font: "inherit",
						fontWeight: "600",
						cursor: "pointer",
					}),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
				]}
			>
				Show stays
			</button>
		</div>
	);
}

/** A number field for one end of the price range, in whole dollars. */
function PriceInput(
	handle: Handle<{ name: "min" | "max"; label: string; value?: number; placeholder: number }>,
) {
	return () => {
		let { label, name, placeholder, value } = handle.props;
		return (
			<label
				mix={[
					raw({
						display: "grid",
						gap: "0.125rem",
						padding: "0.5rem 0.75rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-md)",
						"&:focus-within": { outline: "2px solid var(--ui-brand-ring)" },
					}),
				]}
			>
				<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
					{label}
				</span>
				<span mix={[raw({ display: "flex", alignItems: "center", gap: "0.125rem" })]}>
					$
					<input
						type="number"
						name={name}
						inputmode="numeric"
						min={PRICE_BOUNDS.min}
						max={PRICE_BOUNDS.max}
						step={PRICE_BOUNDS.step}
						value={value === undefined ? "" : String(value)}
						placeholder={String(placeholder)}
						mix={[
							raw({
								inlineSize: "100%",
								minInlineSize: "0",
								border: "0",
								padding: "0",
								background: "transparent",
								font: "inherit",
								fontVariantNumeric: "tabular-nums",
								color: "var(--ui-neutral-fg-emphasis)",
								outline: "none",
							}),
						]}
					/>
				</span>
			</label>
		);
	};
}

/**
 * The filter row: stay types as toggle chips, then price, amenities and sort, each a panel
 * whose form keeps the rest of the search. It scrolls sideways on a phone.
 */
function Filters(handle: Handle<{ search: Search; results: StayResults }>) {
	return () => {
		let { results, search } = handle.props;
		let amenityCount = search.amenities.length;
		let priced = search.min !== undefined || search.max !== undefined;
		let sort = SORTS.find((entry) => entry.id === search.sort) ?? SORTS[0]!;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						overflowX: "auto",
						paddingBlock: "0.25rem",
						[`@media ${SPLIT}`]: { flexWrap: "wrap", overflowX: "visible" },
						marginInline: "calc(-1 * 0.25rem)",
						paddingInline: "0.25rem",
						scrollbarWidth: "none",
					}),
				]}
			>
				<nav aria-label="Type of stay" mix={[raw({ display: "contents" })]}>
					{STAY_TYPES.map((type) => {
						let on = search.types.includes(type.id);
						let types = on
							? search.types.filter((id) => id !== type.id)
							: [...search.types, type.id];
						let count = results.types.get(type.id) ?? 0;
						return (
							<a
								href={resultsHref({ ...search, types })}
								data-on={on ? "" : undefined}
								aria-label={
									on
										? `${type.label}, on. Remove this filter`
										: `Only ${type.label.toLowerCase()}, ${count} ${count === 1 ? "stay" : "stays"}`
								}
								mix={chipStyle()}
							>
								{on ? <CheckIcon aria-hidden="true" size={14} /> : null}
								{type.label}
								<span
									aria-hidden="true"
									mix={[
										raw({
											fontVariantNumeric: "tabular-nums",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{count}
								</span>
							</a>
						);
					})}
				</nav>
				<span
					aria-hidden="true"
					mix={[
						raw({
							flexShrink: "0",
							inlineSize: "1px",
							blockSize: "1.5rem",
							backgroundColor: "var(--ui-neutral-border)",
						}),
					]}
				/>
				<button
					type="button"
					popovertarget="wayfern-price"
					data-on={priced ? "" : undefined}
					mix={chipStyle()}
				>
					{priced
						? `${money((search.min ?? PRICE_BOUNDS.min) * 100)} – ${money((search.max ?? PRICE_BOUNDS.max) * 100)}`
						: "Price"}
					<ChevronDownIcon aria-hidden="true" size={14} />
				</button>
				<Popover
					id="wayfern-price"
					placement="bottom-start"
					aria-label="Price per night"
					mix={[panelStyle()]}
				>
					<form method="get" action={href("s")}>
						<Kept search={search} omit={["price"]} />
						<p
							mix={[
								raw({
									margin: "0 0 0.25rem",
									fontWeight: "650",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							Price per night
						</p>
						<p
							mix={[
								raw({
									margin: "0 0 1rem",
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Before fees and taxes.
						</p>
						<div mix={[raw({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" })]}>
							<PriceInput
								name="min"
								label="Minimum"
								value={search.min}
								placeholder={PRICE_BOUNDS.min}
							/>
							<PriceInput
								name="max"
								label="Maximum"
								value={search.max}
								placeholder={PRICE_BOUNDS.max}
							/>
						</div>
						<PanelActions clear={resultsHref({ ...search, min: undefined, max: undefined })} />
					</form>
				</Popover>
				<button
					type="button"
					popovertarget="wayfern-amenities"
					data-on={amenityCount > 0 ? "" : undefined}
					mix={chipStyle()}
				>
					{amenityCount > 0 ? `Amenities · ${amenityCount}` : "Amenities"}
					<ChevronDownIcon aria-hidden="true" size={14} />
				</button>
				<Popover
					id="wayfern-amenities"
					placement="bottom-start"
					aria-label="Amenities"
					mix={[panelStyle()]}
				>
					<form method="get" action={href("s")}>
						<Kept search={search} omit={["amenity"]} />
						<fieldset mix={[raw({ margin: "0", padding: "0", border: "0" })]}>
							<legend
								mix={[
									raw({
										marginBlockEnd: "0.75rem",
										fontWeight: "650",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								Amenities
							</legend>
							<div
								mix={[
									raw({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1rem" }),
								]}
							>
								{FILTER_AMENITIES.map((id) => (
									<Checkbox
										name="amenity"
										value={id}
										defaultChecked={search.amenities.includes(id)}
									>
										{AMENITIES.find((amenity) => amenity.id === id)?.label}{" "}
										<span
											mix={[
												raw({
													fontVariantNumeric: "tabular-nums",
													color: "var(--ui-neutral-fg-muted)",
												}),
											]}
										>
											({results.amenities.get(id) ?? 0})
										</span>
									</Checkbox>
								))}
							</div>
						</fieldset>
						<PanelActions clear={resultsHref({ ...search, amenities: [] })} />
					</form>
				</Popover>
				<button type="button" popovertarget="wayfern-sort" mix={chipStyle()}>
					<SlidersHorizontalIcon aria-hidden="true" size={14} />
					{sort.label}
				</button>
				<Popover
					id="wayfern-sort"
					placement="bottom-start"
					aria-label="Sort"
					mix={[raw({ padding: "0.375rem", borderRadius: "1rem", minInlineSize: "14rem" })]}
				>
					<ul mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
						{SORTS.map((entry) => (
							<li>
								<a
									href={resultsHref({ ...search, sort: entry.id })}
									aria-current={entry.id === search.sort ? "true" : undefined}
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "1rem",
											minBlockSize: "2.75rem",
											paddingInline: "0.75rem",
											borderRadius: "0.625rem",
											color: "var(--ui-neutral-fg-emphasis)",
											textDecoration: "none",
										}),
										when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
										when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring)" })),
									]}
								>
									{entry.label}
									{entry.id === search.sort ? <CheckIcon aria-hidden="true" size={16} /> : null}
								</a>
							</li>
						))}
					</ul>
				</Popover>
				{filterCount(search) > 0 ? (
					<a
						href={resultsHref({
							...search,
							types: [],
							amenities: [],
							min: undefined,
							max: undefined,
						})}
						mix={[
							raw({
								flexShrink: "0",
								paddingInline: "0.5rem",
								fontSize: "0.875rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						Clear all
					</a>
				) : null}
			</div>
		);
	};
}

/** The phone's floating switch between the list and the map, a link that keeps the search. */
function ViewToggle(handle: Handle<{ search: Search }>) {
	return () => {
		let { search } = handle.props;
		let toMap = search.view === "list";
		return (
			<a
				href={resultsHref({ ...search, view: toMap ? "map" : "list" })}
				mix={[
					raw({
						position: "fixed",
						insetBlockEnd: "calc(5rem + env(safe-area-inset-bottom))",
						insetInlineStart: "50%",
						translate: "-50% 0",
						zIndex: "25",
						display: "inline-flex",
						alignItems: "center",
						gap: "0.5rem",
						blockSize: "3rem",
						paddingInline: "1.25rem",
						borderRadius: "999px",
						backgroundColor: "var(--ui-neutral-bg-solid)",
						color: "var(--ui-neutral-fg-on-solid)",
						fontWeight: "650",
						textDecoration: "none",
						boxShadow: "0 8px 24px -6px rgb(0 0 0 / 0.45)",
						[`@media ${SPLIT}`]: { display: "none" },
					}),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
				]}
			>
				{toMap ? (
					<MapIcon aria-hidden="true" size={18} />
				) : (
					<ListIcon aria-hidden="true" size={18} />
				)}
				{toMap ? "Show map" : "Show list"}
			</a>
		);
	};
}

/** The line over the list: how many stays, where and when. */
function resultsHeading(search: Search, count: number): string {
	let where = `in ${findPlace(search.place ?? "")?.name}`;
	if (search.place === undefined)
		where = search.text === undefined ? "across São Miguel" : `matching “${search.text}”`;
	let when =
		search.start !== undefined && search.end !== undefined
			? ` · ${formatRange(search.start, search.end)}`
			: "";
	return `${count} ${count === 1 ? "stay" : "stays"} ${where}${when}`;
}

/** The results screen. */
export default function Results(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let { back, traveller, url } = handle.props.ctx;
		let search = readSearch(url.searchParams);
		let results = searchStays(search);
		let stays = results.stays;
		let dated = search.start !== undefined && search.end !== undefined;
		let query = tripQuery(search);
		let labels = new Map<string, string>();
		let prices = new Map<string, RemixNode>();
		for (let stay of stays) {
			if (dated) {
				let price = quote(stay, search.start!, search.end!);
				labels.set(stay.id, money(price.total));
				prices.set(stay.id, <TotalPrice total={price.total} nights={price.nights} />);
			} else {
				labels.set(stay.id, money(stay.nightly));
				prices.set(stay.id, <NightlyPrice cents={stay.nightly} />);
			}
		}
		let heading = resultsHeading(search, stays.length);
		let showMap = search.view === "map";
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						[`@media ${SPLIT}`]: { gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)" },
					}),
				]}
			>
				<section
					aria-labelledby="wayfern-results"
					mix={[
						raw({
							display: showMap ? "none" : "block",
							minInlineSize: "0",
							paddingInline: GUTTER,
							paddingBlock: "1.25rem 3rem",
							[`@media ${SPLIT}`]: { display: "block" },
						}),
					]}
				>
					<Filters search={search} results={results} />
					<h1
						id="wayfern-results"
						aria-live="polite"
						mix={[
							raw({
								margin: "1.25rem 0 1.25rem",
								fontSize: "1.0625rem",
								fontWeight: "650",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{heading}
					</h1>
					{stays.length === 0 ? (
						<HeadingScope level={2}>
							<Empty kind="no-results">
								<Empty.Title>No stays match all of that</Empty.Title>
								<Empty.Description>
									Try other dates, fewer amenities or a wider price, or look across the whole
									region.
								</Empty.Description>
								<Empty.Action>
									<a
										href={resultsHref({
											...search,
											types: [],
											amenities: [],
											min: undefined,
											max: undefined,
										})}
										mix={chipStyle()}
									>
										<XIcon aria-hidden="true" size={14} />
										Clear filters
									</a>
								</Empty.Action>
							</Empty>
						</HeadingScope>
					) : (
						<div
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 16rem), 1fr))",
									gap: "2rem 1.5rem",
								}),
							]}
						>
							{stays.map((stay, index) => (
								<StayCard
									stay={stay}
									query={query}
									saved={traveller.saved.includes(stay.id)}
									back={back}
									price={prices.get(stay.id)}
									eager={index < 4}
									mapKey={stay.id}
									level={2}
								/>
							))}
						</div>
					)}
				</section>
				<aside
					aria-label="Map"
					mix={[
						raw({
							display: showMap ? "block" : "none",
							padding: showMap ? "0.75rem" : "0",
							[`@media ${SPLIT}`]: {
								display: "block",
								position: "sticky",
								insetBlockStart: TOP_BAR,
								alignSelf: "start",
								blockSize: `calc(100dvh - ${TOP_BAR})`,
								padding: "1.25rem 1.25rem 1.25rem 0",
							},
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "grid",
								blockSize: "100%",
								overflow: "clip",
								borderRadius: "1rem",
								minBlockSize: showMap ? "calc(100dvh - 11rem)" : "0",
							}),
						]}
					>
						<StaysMap
							id="wayfern-results-map"
							stays={stays}
							labels={labels}
							query={query}
							place={search.place}
							camera={search.camera}
							label={heading}
							navigate={(view) => resultsHref({ ...search, camera: view })}
							area
						/>
						<form id={AREA_FORM} method="get" action={href("s")} hidden>
							{[
								...new URLSearchParams(
									writeSearch({
										...search,
										place: undefined,
										text: undefined,
										bounds: undefined,
										camera: undefined,
									}),
								),
							].map(([name, value]) => (
								<input type="hidden" name={name} value={value} />
							))}
						</form>
					</div>
				</aside>
				<ViewToggle search={search} />
			</div>
		);
	};
}
