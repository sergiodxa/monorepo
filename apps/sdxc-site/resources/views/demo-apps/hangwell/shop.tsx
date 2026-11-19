/**
 * A collection page: every poster, one style or one room, filtered by colour, artist,
 * orientation, price, sale and stock with counts that account for the other filters, sorted
 * and paged in the address. Filters are a GET form, so a filtered page is a link and works
 * without script; on a phone the same filters open in a drawer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { SlidersHorizontalIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { HeadingScope } from "@sdxc/ui";
import { FacetFilters } from "@sdxc/ui/commerce/facet-filters";
import { SortSelect } from "@sdxc/ui/commerce/sort-select";
import { Drawer } from "@sdxc/ui/drawer";
import { LinkButton } from "@sdxc/ui/link-button";

import type { ShopQuery } from "./catalog";
import type { Visitor } from "./state";

import { POSTER_FACETS, SORTS, runShopQuery, shopLink } from "./catalog";
import { ARTISTS, STYLES, findArtist, findPaint, href, money } from "./data";
import { Gutter, PageTitle, PosterGrid } from "./parts";

/** The filter drawer's id on phones. */
const FILTER_DRAWER = "hw-filters";

/** The page path a query's links go to. */
function basePath(query: ShopQuery): string {
	return query.collection === null ? "shop" : `shop/${query.collection.id}`;
}

/** A price interval in whole euros, in words, such as "€20 – €25" or "€30 and up". */
function rangeLabel(min: number | null, max: number | null): string {
	let euros = (value: number) => money(value * 100).replace(/\.00$/, "");
	if (min !== null && max !== null)
		return min === 0 ? `Under ${euros(max)}` : `${euros(min)} – ${euros(max)}`;
	if (min !== null) return `${euros(min)} and up`;
	if (max !== null) return `Under ${euros(max)}`;
	return "Any price";
}

/** The name a facet value reads as in a chip. */
function chipLabel(facet: string, value: unknown): string {
	if (facet === "color") return findPaint(String(value))?.name ?? String(value);
	if (facet === "style") return STYLES.find((style) => style.id === value)?.name ?? String(value);
	if (facet === "artist") return findArtist(String(value))?.name ?? String(value);
	if (facet === "orientation") return value === "portrait" ? "Portrait" : "Landscape";
	if (facet === "price" && typeof value === "object" && value !== null) {
		let range = value as { min: number | null; max: number | null };
		return rangeLabel(range.min, range.max);
	}
	if (facet === "sale") return "On sale";
	if (facet === "framed") return "Framed, ready to ship";
	return String(value);
}

namespace Filters {
	export interface Props {
		query: ShopQuery;
		url: URL;
		id: string;
	}
}

/** The filter form, the same on the sidebar and in the phone drawer. */
function Filters(handle: Handle<Filters.Props>) {
	return () => {
		let { id, query, url } = handle.props;
		let { counts } = runShopQuery(query);
		let base = href(basePath(query));
		let keep: Record<string, string> = {};
		let sort = url.searchParams.get("sort");
		if (sort !== null) keep.sort = sort;
		let selected = query.filters;
		return (
			<FacetFilters id={id} action={base} keep={keep} labels={{ apply: "Show results" }}>
				{query.collection?.kind === "style" ? null : (
					<FacetFilters.Group title="Style">
						{counts.style.map((option) => (
							<FacetFilters.Check
								name="style"
								value={option.value}
								label={STYLES.find((style) => style.id === option.value)?.name ?? option.value}
								count={option.count}
								checked={option.selected}
							/>
						))}
					</FacetFilters.Group>
				)}
				<FacetFilters.Group title="Colour">
					{counts.color.map((option) => (
						<FacetFilters.Check
							name="color"
							value={option.value}
							label={findPaint(option.value)?.name ?? option.value}
							swatch={findPaint(option.value)?.color}
							count={option.count}
							checked={option.selected}
						/>
					))}
				</FacetFilters.Group>
				<FacetFilters.Group title="Price">
					<FacetFilters.Range
						minName="price_min"
						maxName="price_max"
						min={selected.price.min}
						max={selected.price.max}
						prefix="€"
						labels={{ min: "Lowest price, euros", max: "Highest price, euros" }}
						buckets={counts.price.buckets.map((bucket) => ({
							label: rangeLabel(bucket.min, bucket.max),
							count: bucket.count,
							selected: bucket.selected,
							href: shopLink(base, url.searchParams, {
								...selected,
								price: bucket.selected
									? { min: null, max: null }
									: { min: bucket.min, max: bucket.max },
							}),
						}))}
					/>
				</FacetFilters.Group>
				<FacetFilters.Group title="Availability">
					<FacetFilters.Toggle
						name="ready"
						label="Framed, ready to ship"
						count={counts.framed.count}
						checked={counts.framed.selected}
					/>
					<FacetFilters.Toggle
						name="sale"
						label="On sale"
						count={counts.sale.count}
						checked={counts.sale.selected}
					/>
				</FacetFilters.Group>
				<FacetFilters.Group title="Orientation" open={false}>
					{counts.orientation.map((option) => (
						<FacetFilters.Check
							name="orientation"
							value={option.value}
							label={option.value === "portrait" ? "Portrait" : "Landscape"}
							count={option.count}
							checked={option.selected}
						/>
					))}
				</FacetFilters.Group>
				<FacetFilters.Group title="Artist" open={selected.artist.length > 0}>
					{counts.artist.map((option) => (
						<FacetFilters.Check
							name="artist"
							value={option.value}
							label={ARTISTS.find((artist) => artist.id === option.value)?.name ?? option.value}
							count={option.count}
							checked={option.selected}
						/>
					))}
				</FacetFilters.Group>
			</FacetFilters>
		);
	};
}

namespace ShopPage {
	export interface Props {
		query: ShopQuery;
		url: URL;
		visitor: Visitor;
		/** The page path the wishlist hearts return to. */
		back: string;
	}
}

/** A collection page. */
export default function ShopPage(handle: Handle<ShopPage.Props>) {
	return () => {
		let { back, query, url, visitor } = handle.props;
		let result = runShopQuery(query);
		let base = href(basePath(query));
		let chips = POSTER_FACETS.applied(query.filters).map((chip) => ({
			label: chipLabel(chip.facet, chip.value),
			href: shopLink(base, url.searchParams, chip.filters),
		}));
		let clear = new URLSearchParams();
		let sort = url.searchParams.get("sort");
		if (sort !== null) clear.set("sort", sort);
		let clearHref = clear.size === 0 ? base : `${base}?${clear}`;
		let title =
			query.collection?.name ?? (url.searchParams.get("sale") === "1" ? "Sale" : "All posters");
		let sortParams = POSTER_FACETS.serialize(query.filters);
		let more = new URLSearchParams(url.searchParams);
		more.set("page", String(query.pages + 1));
		let activeCount = chips.length;
		return (
			<Gutter>
				<PageTitle
					eyebrow={{ none: "Shop", style: "Style", room: "Room" }[query.collection?.kind ?? "none"]}
					lead={query.collection?.blurb ?? "Every poster in the studio, printed to order."}
				>
					{title}
				</PageTitle>
				{query.issues.length === 0 ? null : (
					<p role="status" mix={[raw({ margin: "0 0 1rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Some filters in this link no longer exist, so they were left out.
					</p>
				)}
				<div
					mix={[
						raw({
							display: "grid",
							gap: "1.5rem 2.5rem",
							"@media (min-width: 56rem)": { gridTemplateColumns: "15rem minmax(0, 1fr)" },
						}),
					]}
				>
					<aside
						aria-label="Filters"
						mix={[
							raw({
								display: "none",
								"@media (min-width: 56rem)": {
									display: "block",
									position: "sticky",
									insetBlockStart: "5rem",
									alignSelf: "start",
									maxBlockSize: "calc(100dvh - 6rem)",
									overflowY: "auto",
									paddingInlineEnd: "0.5rem",
								},
							}),
						]}
					>
						<Filters id="hw-filter-side" query={query} url={url} />
					</aside>
					<div
						mix={[
							raw({ display: "grid", gap: "1.25rem", alignContent: "start", minInlineSize: "0" }),
						]}
					>
						<div
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "0.75rem",
								}),
							]}
						>
							<p
								mix={[
									raw({
										margin: "0",
										color: "var(--ui-neutral-fg-muted)",
										fontVariantNumeric: "tabular-nums",
									}),
								]}
								aria-live="polite"
							>
								{result.total === 1 ? "1 poster" : `${result.total} posters`}
							</p>
							<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}>
								<button
									type="button"
									command="show-modal"
									commandfor={FILTER_DRAWER}
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											gap: "0.5rem",
											blockSize: "2.5rem",
											paddingInline: "1rem",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "999px",
											background: "none",
											font: "inherit",
											fontWeight: "500",
											color: "inherit",
											cursor: "pointer",
											"& svg": { inlineSize: "1rem", blockSize: "1rem" },
											"@media (min-width: 56rem)": { display: "none" },
										}),
									]}
								>
									<SlidersHorizontalIcon />
									Filters{activeCount === 0 ? "" : ` (${activeCount})`}
								</button>
								<form method="get" action={base} id="hw-sort" mix={[raw({ margin: "0" })]}>
									{[...sortParams.entries()].map(([name, value]) => (
										<input type="hidden" name={name} value={value} />
									))}
									<SortSelect
										name="sort"
										value={query.sort.id}
										label="Sort by"
										options={SORTS.map((entry) => ({ value: entry.id, label: entry.label }))}
									/>
									<noscript>
										<button type="submit">Sort</button>
									</noscript>
								</form>
							</div>
						</div>
						<FacetFilters.Applied
							label="Applied filters"
							chips={chips}
							clear={chips.length === 0 ? undefined : { label: "Clear all", href: clearHref }}
						/>
						{result.total === 0 ? (
							<NoResults clearHref={clearHref} />
						) : (
							<PosterGrid posters={result.posters} wish={visitor.wish} back={back} label={title} />
						)}
						{result.more ? (
							<div
								mix={[
									raw({
										display: "grid",
										justifyItems: "center",
										gap: "0.5rem",
										paddingBlock: "1.5rem",
									}),
								]}
							>
								<p
									mix={[
										raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" }),
									]}
								>
									Showing {result.posters.length} of {result.total}
								</p>
								<LinkButton href={`${base}?${more}`} variant="outline">
									Show more
								</LinkButton>
							</div>
						) : null}
					</div>
				</div>
				<HeadingScope level={2}>
					<Drawer id={FILTER_DRAWER} placement="bottom" aria-labelledby={`${FILTER_DRAWER}-title`}>
						<Drawer.Header>
							<Drawer.Title id={`${FILTER_DRAWER}-title`}>Filters</Drawer.Title>
							<Drawer.Close commandfor={FILTER_DRAWER} aria-label="Close filters" />
						</Drawer.Header>
						<div mix={[raw({ padding: "0 1.25rem 1.5rem", overflowY: "auto" })]}>
							<Filters id="hw-filter-sheet" query={query} url={url} />
						</div>
					</Drawer>
				</HeadingScope>
			</Gutter>
		);
	};
}

/** The grid's state when the filters leave nothing: why, and the way out. */
function NoResults(handle: Handle<{ clearHref: string }>) {
	return (): RemixNode => (
		<div
			mix={[
				raw({
					display: "grid",
					justifyItems: "center",
					gap: "0.75rem",
					paddingBlock: "4rem",
					textAlign: "center",
				}),
			]}
		>
			<p mix={[raw({ margin: "0", fontSize: "1.25rem", fontWeight: "500" })]}>
				No posters match all of these filters
			</p>
			<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
				Remove a filter above, or start over.
			</p>
			<LinkButton href={handle.props.clearHref} variant="outline">
				Clear all filters
			</LinkButton>
		</div>
	);
}
