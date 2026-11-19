/**
 * Wayfern's search: where (with suggested places), the dates and who is coming, as one pill
 * bar on a wide screen and as a full-screen sheet on a phone. Both are plain GET forms to the
 * results, so a search is an address and works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { MapPinIcon, MountainIcon, SearchIcon, SunIcon, TreePineIcon, XIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Autocomplete } from "@sdxc/ui/autocomplete";

import type { Motif } from "./data";
import type { Search } from "./query";

import { PLACES, findPlace, href } from "./data";
import { DatesField } from "./dates-field";
import { formatRange } from "./days";
import { GuestsField } from "./guests-field";
import { WIDE } from "./layout";
import { partyLabel } from "./query";

/** The id of the full-screen search sheet every compact search opens. */
export const SEARCH_SHEET = "wayfern-search";

/** The icon a suggested place carries, drawn from its landscape. */
const MOTIF_ICONS: Record<Motif, typeof MapPinIcon> = {
	coast: SunIcon,
	dunes: SunIcon,
	pines: TreePineIcon,
	lake: MapPinIcon,
	peaks: MountainIcon,
	town: MapPinIcon,
};

/** Every place as a suggestion row: its name, what it is like, and an icon for its landscape. */
function placeOptions() {
	return PLACES.map((place) => {
		let Icon = MOTIF_ICONS[place.motif];
		return {
			value: place.id,
			label: place.name,
			description: place.blurb,
			icon: <Icon size={20} />,
		};
	});
}

/**
 * The filters a new search keeps from the one on screen, as hidden fields, so changing the
 * dates doesn't drop the amenities someone already chose.
 */
function KeptFilters(handle: Handle<{ search: Search }>) {
	return () => {
		let { search } = handle.props;
		return (
			<>
				{search.types.map((type) => (
					<input type="hidden" name="type" value={type} />
				))}
				{search.min === undefined ? null : (
					<input type="hidden" name="min" value={String(search.min)} />
				)}
				{search.max === undefined ? null : (
					<input type="hidden" name="max" value={String(search.max)} />
				)}
				{search.amenities.map((amenity) => (
					<input type="hidden" name="amenity" value={amenity} />
				))}
				{search.sort === "recommended" ? null : (
					<input type="hidden" name="sort" value={search.sort} />
				)}
			</>
		);
	};
}

namespace SearchForm {
	export interface Props {
		search: Search;
		today: string;
		/** `bar` is the wide pill; `stack` is the sheet's column of cards. */
		layout: "bar" | "stack";
		/** A prefix for element ids, unique on the page. */
		id: string;
		/** The page a calendar link reloads without script. */
		base: string;
	}
}

/** The label above a stacked section of the phone's sheet. */
function StackLabel(handle: Handle<{ children: string }>) {
	return () => (
		<span
			mix={[
				raw({
					fontSize: "1.125rem",
					fontWeight: "650",
					color: "var(--ui-neutral-fg-emphasis)",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

/**
 * The search form itself. The bar puts the fields in one rounded row with a round search
 * button; the stack gives each its own card, as a phone's sheet does.
 */
export function SearchForm(handle: Handle<SearchForm.Props>) {
	return () => {
		let { base, id, layout, search, today } = handle.props;
		let where =
			search.place === undefined ? (search.text ?? "") : (findPlace(search.place)?.name ?? "");
		let whereField = (
			<Autocomplete
				id={`${id}-where`}
				name="where"
				label="Where"
				placeholder="Search destinations"
				heading="Suggested destinations"
				defaultValue={where}
				variant="bare"
				options={placeOptions()}
				parts={{
					input: [
						raw({
							fontSize: layout === "bar" ? "0.875rem" : "1rem",
							blockSize: "auto",
							padding: "0",
							"&::placeholder": { color: "var(--ui-neutral-fg-muted)" },
						}),
					],
				}}
			/>
		);
		if (layout === "stack") {
			let card = raw({
				display: "grid",
				gap: "0.75rem",
				padding: "1rem",
				borderRadius: "1.25rem",
				backgroundColor: "var(--ui-bg)",
				boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 6px 20px -8px rgb(0 0 0 / 0.18)",
			});
			return (
				<form
					method="get"
					action={href("s")}
					role="search"
					aria-label="Search stays"
					mix={[raw({ display: "grid", gap: "0.875rem" })]}
				>
					<div mix={[card]}>
						<StackLabel>Where to?</StackLabel>
						<div
							mix={[
								raw({
									padding: "0.75rem 1rem",
									border: "1px solid var(--ui-neutral-border-strong, var(--ui-neutral-border))",
									borderRadius: "var(--ui-radius-lg)",
									"&:focus-within": { outline: "2px solid var(--ui-brand-ring)" },
								}),
							]}
						>
							{whereField}
						</div>
					</div>
					<div mix={[card]}>
						<StackLabel>When</StackLabel>
						<div
							mix={[
								raw({
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-lg)",
									overflow: "clip",
								}),
							]}
						>
							<DatesField
								id={`${id}-dates`}
								start={search.start}
								end={search.end}
								today={today}
								base={base}
								months={1}
								boxed
							/>
						</div>
					</div>
					<div mix={[card]}>
						<StackLabel>Who</StackLabel>
						<div
							mix={[
								raw({
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-lg)",
									overflow: "clip",
								}),
							]}
						>
							<GuestsField
								id={`${id}-guests`}
								adults={search.adults}
								kids={search.children}
								boxed
							/>
						</div>
					</div>
					<KeptFilters search={search} />
					<button
						type="submit"
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "0.5rem",
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
						]}
					>
						<SearchIcon aria-hidden="true" size={18} />
						Search
					</button>
				</form>
			);
		}
		return (
			<form
				method="get"
				action={href("s")}
				role="search"
				aria-label="Search stays"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(10rem, 1.3fr) minmax(14rem, 1.6fr) minmax(8rem, 1fr) auto",
						alignItems: "stretch",
						inlineSize: "min(100%, 54rem)",
						textAlign: "start",
						minBlockSize: "4rem",
						padding: "0.375rem",
						borderRadius: "999px",
						backgroundColor: "var(--ui-bg)",
						boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 8px 28px -12px rgb(0 0 0 / 0.25)",
					}),
				]}
			>
				<label
					htmlFor={`${id}-where`}
					mix={[
						raw({
							display: "grid",
							alignContent: "center",
							gap: "0.125rem",
							minInlineSize: "0",
							paddingInline: "1.25rem",
							borderRadius: "999px",
							cursor: "text",
							"&:focus-within": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
						}),
						when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
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
						Where
					</span>
					{whereField}
				</label>
				<DatesField
					id={`${id}-dates`}
					start={search.start}
					end={search.end}
					today={today}
					base={base}
				/>
				<GuestsField id={`${id}-guests`} adults={search.adults} kids={search.children} />
				<KeptFilters search={search} />
				<button
					type="submit"
					aria-label="Search"
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "0.5rem",
							minInlineSize: "3.25rem",
							paddingInline: "1rem",
							border: "0",
							borderRadius: "999px",
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
					<span
						mix={[raw({ display: "none", "@media (min-width: 64rem)": { display: "inline" } })]}
					>
						Search
					</span>
				</button>
			</form>
		);
	};
}

/** The search in a few words: where, when and who, for the compact pill. */
export function searchSummary(search: Search): { where: string; when: string; who: string } {
	let where =
		search.place === undefined
			? (search.text ?? "Anywhere")
			: (findPlace(search.place)?.name ?? "Anywhere");
	let when =
		search.start !== undefined && search.end !== undefined
			? formatRange(search.start, search.end)
			: "Any week";
	return {
		where,
		when,
		who:
			search.adults + search.children === 2 && search.children === 0
				? "Add guests"
				: partyLabel(search),
	};
}

/**
 * The compact search in the top bar: a pill naming the current search that opens the
 * full-screen sheet. It is how a phone searches, and how a wide screen changes a search
 * from a listing.
 */
export function SearchPill(handle: Handle<{ search: Search }>) {
	return () => {
		let summary = searchSummary(handle.props.search);
		let divider = raw({
			inlineSize: "1px",
			blockSize: "1.25rem",
			backgroundColor: "var(--ui-neutral-border)",
		});
		return (
			<button
				type="button"
				commandfor={SEARCH_SHEET}
				command="show-modal"
				aria-label={`Search: ${summary.where}, ${summary.when}, ${summary.who}`}
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.75rem",
						inlineSize: "min(100%, 26rem)",
						minBlockSize: "3rem",
						paddingInline: "1.125rem 0.375rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "999px",
						background: "var(--ui-bg)",
						boxShadow: "0 2px 10px -4px rgb(0 0 0 / 0.18)",
						color: "var(--ui-neutral-fg-emphasis)",
						font: "inherit",
						fontSize: "0.875rem",
						fontWeight: "600",
						cursor: "pointer",
						textAlign: "start",
						transition: "box-shadow 140ms ease",
					}),
					when("&:hover", raw({ boxShadow: "0 4px 14px -4px rgb(0 0 0 / 0.25)" })),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
				]}
			>
				<span
					mix={[
						raw({
							flex: "1 1 auto",
							minInlineSize: "0",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}),
					]}
				>
					{summary.where}
				</span>
				<span
					aria-hidden="true"
					mix={[divider, raw({ display: "none", [`@media ${WIDE}`]: { display: "block" } })]}
				/>
				<span
					mix={[
						raw({
							display: "none",
							whiteSpace: "nowrap",
							[`@media ${WIDE}`]: { display: "inline" },
						}),
					]}
				>
					{summary.when}
				</span>
				<span
					aria-hidden="true"
					mix={[divider, raw({ display: "none", [`@media ${WIDE}`]: { display: "block" } })]}
				/>
				<span
					mix={[
						raw({
							display: "none",
							whiteSpace: "nowrap",
							fontWeight: "450",
							color: "var(--ui-neutral-fg-muted)",
							[`@media ${WIDE}`]: { display: "inline" },
						}),
					]}
				>
					{summary.who}
				</span>
				<span
					aria-hidden="true"
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							flexShrink: "0",
							inlineSize: "2.25rem",
							blockSize: "2.25rem",
							borderRadius: "999px",
							backgroundColor: "var(--ui-brand-bg-solid)",
							color: "var(--ui-brand-fg-on-solid)",
						}),
					]}
				>
					<SearchIcon size={16} />
				</span>
			</button>
		);
	};
}

/**
 * The search sheet: full screen on a phone, a centred panel on a wide screen, opened by the
 * pill without script through the platform's command buttons and closed the same way.
 */
export function SearchSheet(handle: Handle<{ search: Search; today: string; base: string }>) {
	return () => {
		let { base, search, today } = handle.props;
		return (
			<dialog
				id={SEARCH_SHEET}
				aria-labelledby={`${SEARCH_SHEET}-title`}
				closedby="any"
				mix={[
					raw({
						inlineSize: "100%",
						maxInlineSize: "100%",
						blockSize: "100dvh",
						maxBlockSize: "100dvh",
						margin: "0",
						padding: "0",
						border: "0",
						backgroundColor: "var(--ui-neutral-bg-subtle, var(--ui-bg))",
						color: "var(--ui-neutral-fg)",
						overflow: "auto",
						"&::backdrop": { backgroundColor: "rgb(0 0 0 / 0.4)" },
						[`@media ${WIDE}`]: {
							inlineSize: "min(32rem, calc(100vw - 2rem))",
							blockSize: "auto",
							maxBlockSize: "calc(100dvh - 4rem)",
							margin: "auto",
							borderRadius: "1.5rem",
							boxShadow: "0 30px 80px -20px rgb(0 0 0 / 0.45)",
						},
					}),
				]}
			>
				<div
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: "0",
							zIndex: "1",
							display: "flex",
							alignItems: "center",
							gap: "0.75rem",
							padding: "0.75rem 1rem",
							backgroundColor: "inherit",
						}),
					]}
				>
					<button
						type="button"
						commandfor={SEARCH_SHEET}
						command="close"
						aria-label="Close search"
						mix={[
							raw({
								display: "inline-grid",
								placeItems: "center",
								inlineSize: "2.75rem",
								blockSize: "2.75rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "999px",
								background: "var(--ui-bg)",
								color: "var(--ui-neutral-fg-emphasis)",
								cursor: "pointer",
							}),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
							),
						]}
					>
						<XIcon aria-hidden="true" size={18} />
					</button>
					<h2
						id={`${SEARCH_SHEET}-title`}
						mix={[
							raw({
								margin: "0",
								fontSize: "1rem",
								fontWeight: "650",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						Find a stay
					</h2>
				</div>
				<div mix={[raw({ padding: "0.25rem 1rem 1.5rem" })]}>
					<SearchForm search={search} today={today} layout="stack" id="sheet" base={base} />
				</div>
			</dialog>
		);
	};
}
