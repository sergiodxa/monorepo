/**
 * Bocado's search: a query box, the cuisines, and filters as toggle chips and a sort menu,
 * all kept in the address so a filtered search is a link to send. Results list the matching
 * dishes first, then the restaurants, and each kind of empty result says why it is empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowUpDownIcon, CheckIcon, SearchIcon, XIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LinkButton, Menu } from "@sdxc/ui";

import type { Cuisine, SearchQuery, Sort } from "./data";

import { DishArt } from "./art";
import { SORTS, href, money, searchDishes, searchRestaurants } from "./data";
import { CARD_RADIUS, CuisineChips, Gutter, RestaurantGrid } from "./parts";

/** The sort menu's popover id. */
const SORT_MENU = "bocado-sort";

/**
 * The search address for a query with some of its filters changed. A filter at its
 * unfiltered value leaves the address, so every search has one address.
 *
 * @param query The search as it stands.
 * @param change The filters to change.
 */
export function searchHref(query: SearchQuery, change: Partial<SearchQuery> = {}): string {
	let next = { ...query, ...change };
	let params = new URLSearchParams();
	if (next.q !== "") params.set("q", next.q);
	if (next.cuisine !== undefined) params.set("cuisine", next.cuisine.id);
	if (next.sort !== "relevance") params.set("sort", next.sort);
	if (next.freeDelivery) params.set("free", "1");
	if (next.fast) params.set("fast", "1");
	if (next.open) params.set("open", "1");
	if (next.rating > 0) params.set("rating", String(next.rating));
	if (next.price < 3) params.set("price", String(next.price));
	let search = params.toString();
	return search === "" ? "search" : `search?${search}`;
}

/** How many filters other than the query and sort a search applies. */
function filterCount(query: SearchQuery): number {
	return [
		query.cuisine !== undefined,
		query.freeDelivery,
		query.fast,
		query.open,
		query.rating > 0,
		query.price < 3,
	].filter(Boolean).length;
}

/** The look of a filter chip; a pressed one is filled. */
function chip() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			flexShrink: "0",
			blockSize: "2.25rem",
			paddingInline: "0.875rem",
			border: "0",
			borderRadius: "999px",
			font: "inherit",
			fontSize: "0.875rem",
			fontWeight: "600",
			whiteSpace: "nowrap",
			color: "var(--ui-neutral-fg-emphasis)",
			backgroundColor: "transparent",
			boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
			textDecoration: "none",
			cursor: "pointer",
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
		when(
			"&[aria-pressed='true']",
			raw({
				color: "var(--ui-neutral-fg-on-solid)",
				backgroundColor: "var(--ui-neutral-bg-solid)",
				boxShadow: "none",
			}),
		),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
	];
}

/** One toggle filter as a link that flips it, marked pressed while it applies. */
function FilterChip(handle: Handle<{ label: string; on: boolean; to: string }>) {
	return () => {
		let { label, on, to } = handle.props;
		return (
			<a
				href={href(to)}
				role="button"
				aria-pressed={on ? "true" : "false"}
				data-filter-chip=""
				mix={chip()}
			>
				{on ? <CheckIcon aria-hidden="true" size={15} /> : null}
				{label}
			</a>
		);
	};
}

/** The sort menu: its trigger names the sort in force, and each choice is a link. */
function SortMenu(handle: Handle<{ query: SearchQuery }>) {
	return () => {
		let { query } = handle.props;
		return (
			<>
				<button
					type="button"
					commandfor={SORT_MENU}
					command="toggle-popover"
					aria-label={`Sort: ${SORTS[query.sort]}`}
					mix={chip()}
				>
					<ArrowUpDownIcon aria-hidden="true" size={15} />
					{SORTS[query.sort]}
				</button>
				<Menu id={SORT_MENU} placement="bottom-start" aria-label="Sort restaurants">
					{(Object.keys(SORTS) as Sort[]).map((sort) => (
						<Menu.Item
							href={href(searchHref(query, { sort }))}
							aria-current={sort === query.sort ? "true" : undefined}
						>
							<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })]}>
								<span mix={[raw({ inlineSize: "1rem", display: "inline-grid" })]}>
									{sort === query.sort ? <CheckIcon aria-hidden="true" size={16} /> : null}
								</span>
								{SORTS[sort]}
							</span>
						</Menu.Item>
					))}
				</Menu>
			</>
		);
	};
}

/** The dishes whose names match the query, each linking to its restaurant's menu. */
function DishMatches(handle: Handle<{ q: string }>) {
	return () => {
		let matches = searchDishes(handle.props.q);
		if (matches.length === 0) return null;
		return (
			<section aria-labelledby="bocado-dishes" mix={[raw({ marginBlockEnd: "2rem" })]}>
				<h2
					id="bocado-dishes"
					mix={[raw({ margin: "0 0 0.75rem", fontSize: "1.125rem", fontWeight: "750" })]}
				>
					Dishes
				</h2>
				<ul
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(min(17rem, 100%), 1fr))",
							gap: "0.75rem",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
					]}
				>
					{matches.map(({ item, restaurant }) => (
						<li>
							<a
								href={`${href(`r/${restaurant.id}`)}#dish-${item.id}`}
								data-main-scroll-top=""
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "3.5rem minmax(0, 1fr)",
										alignItems: "center",
										gap: "0.75rem",
										padding: "0.5rem",
										borderRadius: CARD_RADIUS,
										color: "inherit",
										textDecoration: "none",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
									}),
									when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-subtle)" })),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
								]}
							>
								<span
									mix={[
										raw({
											inlineSize: "3.5rem",
											blockSize: "3.5rem",
											padding: "0.25rem",
											boxSizing: "border-box",
											borderRadius: "0.75rem",
											backgroundColor: restaurant.tones[0],
										}),
									]}
								>
									<DishArt dish={item.dish} />
								</span>
								<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
									<span mix={[raw({ fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" })]}>
										{item.name}
									</span>
									<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
										{restaurant.name} · {money(item.price)}
									</span>
								</span>
							</a>
						</li>
					))}
				</ul>
			</section>
		);
	};
}

/** An empty result, saying why it is empty and offering the way out that fits. */
function NoResults(handle: Handle<{ query: SearchQuery }>) {
	return () => {
		let { query } = handle.props;
		let filters = filterCount(query);
		let title =
			query.q !== "" && filters === 0
				? `Nothing called “${query.q}” delivers here`
				: "No restaurant matches every filter";
		let body =
			query.q !== "" && filters === 0
				? "Try a dish, such as dumplings, or a cuisine."
				: `${filters} ${filters === 1 ? "filter is" : "filters are"} narrowing this down. Clear them to see more.`;
		let action =
			query.q !== "" && filters === 0
				? { label: "Clear search", to: "search" }
				: {
						label: "Clear filters",
						to: searchHref({
							...query,
							cuisine: undefined,
							freeDelivery: false,
							fast: false,
							open: false,
							rating: 0,
							price: 3,
						}),
					};
		return (
			<div
				data-search-empty=""
				mix={[
					raw({
						display: "grid",
						justifyItems: "center",
						gap: "0.625rem",
						paddingBlock: "3.5rem",
						textAlign: "center",
					}),
				]}
			>
				<span mix={[raw({ inlineSize: "5rem", opacity: "0.85" })]}>
					<DishArt dish="bowl" />
				</span>
				<h2 mix={[raw({ margin: "0", fontSize: "1.25rem", fontWeight: "750" })]}>{title}</h2>
				<p
					mix={[raw({ margin: "0", maxInlineSize: "26rem", color: "var(--ui-neutral-fg-muted)" })]}
				>
					{body}
				</p>
				<LinkButton href={href(action.to)} variant="outline">
					{action.label}
				</LinkButton>
			</div>
		);
	};
}

namespace SearchPage {
	export interface Props {
		query: SearchQuery;
	}
}

/** Renders the search screen for the address's query and filters. */
export default function SearchPage(handle: Handle<SearchPage.Props>) {
	return () => {
		let { query } = handle.props;
		let results = searchRestaurants(query);
		let filters = filterCount(query);
		let heading = query.q !== "" ? `Results for “${query.q}”` : (query.cuisine?.name ?? "Search");
		return (
			<Gutter>
				<div mix={[raw({ display: "grid", gap: "1rem", paddingBlock: "1.5rem 1.25rem" })]}>
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)",
								fontWeight: "800",
								letterSpacing: "-0.02em",
							}),
						]}
					>
						{heading}
					</h1>
					<form
						method="get"
						action={href("search")}
						role="search"
						mix={[
							raw({ position: "relative", display: "flex", gap: "0.5rem", maxInlineSize: "40rem" }),
						]}
					>
						{query.cuisine === undefined ? null : (
							<input type="hidden" name="cuisine" value={query.cuisine.id} />
						)}
						{query.sort === "relevance" ? null : (
							<input type="hidden" name="sort" value={query.sort} />
						)}
						{query.freeDelivery ? <input type="hidden" name="free" value="1" /> : null}
						{query.fast ? <input type="hidden" name="fast" value="1" /> : null}
						{query.open ? <input type="hidden" name="open" value="1" /> : null}
						{query.rating > 0 ? (
							<input type="hidden" name="rating" value={String(query.rating)} />
						) : null}
						{query.price < 3 ? (
							<input type="hidden" name="price" value={String(query.price)} />
						) : null}
						<SearchIcon
							aria-hidden="true"
							size={18}
							mix={[
								raw({
									position: "absolute",
									insetInlineStart: "1rem",
									insetBlockStart: "50%",
									translate: "0 -50%",
									color: "var(--ui-neutral-fg-muted)",
									pointerEvents: "none",
								}),
							]}
						/>
						<input
							type="search"
							name="q"
							value={query.q}
							aria-label="Search restaurants and dishes"
							placeholder="Empanadas, ramen, a restaurant…"
							autocomplete="off"
							mix={[
								raw({
									flex: "1 1 auto",
									minInlineSize: "0",
									blockSize: "3rem",
									paddingInline: "2.75rem 1rem",
									border: "0",
									borderRadius: "999px",
									font: "inherit",
									fontSize: "1rem",
									color: "var(--ui-neutral-fg-emphasis)",
									backgroundColor: "var(--ui-neutral-bg-subtle)",
								}),
								when(
									"&:focus",
									raw({ outline: "none", boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" }),
								),
							]}
						/>
						<button
							type="submit"
							mix={[
								raw({
									flexShrink: "0",
									blockSize: "3rem",
									paddingInline: "1.25rem",
									border: "0",
									borderRadius: "999px",
									font: "inherit",
									fontWeight: "700",
									color: "var(--ui-brand-fg-on-solid, white)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									cursor: "pointer",
								}),
								when(
									"&:focus-visible",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
							]}
						>
							Search
						</button>
					</form>
					<CuisineChips
						current={query.cuisine}
						hrefFor={(cuisine: Cuisine | undefined) => href(searchHref(query, { cuisine }))}
					/>
					<div
						aria-label="Filters"
						role="group"
						mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" })]}
					>
						<SortMenu query={query} />
						<FilterChip
							label="Free delivery"
							on={query.freeDelivery}
							to={searchHref(query, { freeDelivery: !query.freeDelivery })}
						/>
						<FilterChip
							label="Under 30 min"
							on={query.fast}
							to={searchHref(query, { fast: !query.fast })}
						/>
						<FilterChip
							label="Rated 4.5+"
							on={query.rating === 4.5}
							to={searchHref(query, { rating: query.rating === 4.5 ? 0 : 4.5 })}
						/>
						<FilterChip
							label="$ only"
							on={query.price === 1}
							to={searchHref(query, { price: query.price === 1 ? 3 : 1 })}
						/>
						<FilterChip
							label="Open now"
							on={query.open}
							to={searchHref(query, { open: !query.open })}
						/>
						{filters === 0 ? null : (
							<a
								href={href(
									searchHref({
										...query,
										cuisine: undefined,
										freeDelivery: false,
										fast: false,
										open: false,
										rating: 0,
										price: 3,
									}),
								)}
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.25rem",
										fontSize: "0.875rem",
										fontWeight: "650",
										color: "var(--ui-brand-fg)",
										textDecoration: "none",
										paddingInline: "0.5rem",
									}),
									when("&:hover", raw({ textDecoration: "underline" })),
								]}
							>
								<XIcon aria-hidden="true" size={15} />
								Clear {filters === 1 ? "filter" : `${filters} filters`}
							</a>
						)}
					</div>
				</div>
				{query.q === "" ? null : <DishMatches q={query.q} />}
				{results.length === 0 ? (
					<NoResults query={query} />
				) : (
					<section aria-labelledby="bocado-results">
						<h2
							id="bocado-results"
							data-result-count={String(results.length)}
							mix={[
								raw({
									margin: "0 0 1rem",
									fontSize: "0.9375rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{results.length} {results.length === 1 ? "restaurant" : "restaurants"} ·{" "}
							{SORTS[query.sort]}
						</h2>
						<RestaurantGrid restaurants={results} />
					</section>
				)}
			</Gutter>
		);
	};
}
