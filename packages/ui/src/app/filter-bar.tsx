/**
 * The toolbar above a list: count tabs on the left, facet filters with per-value counts in
 * the middle, search, sort and view controls on the right, and the applied filters as chips
 * below. Every control writes a URL search parameter through one GET form, so it works unscripted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ArrowUpDownIcon, ChevronDownIcon, ListFilterIcon, XIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import {
	basis,
	container,
	flex,
	flexWrap,
	gap,
	grow,
	hidden,
	hstack,
	inline,
	inlineFlex,
	items,
	justify,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { divide, overflowY } from "@sdxc/u/overflow";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, maxBs, maxIs, minIs, mis, p, pb, pi, pis } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { nowrap, tabularNums, text, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";
import { Checkbox } from "../components/checkbox.js";
import { Keyboard } from "../components/keyboard.js";
import { Menu } from "../components/menu.js";
import { Popover } from "../components/popover.js";
import { SearchField } from "../components/search-field.js";
import { floatingSurface, surfaceInset } from "../styles/floating-surface.js";
import { interactiveTransition } from "../styles/interactive-transition.js";

import { escapeLink } from "./mixins/escape-link.js";
import {
	carriedParams,
	clearFiltersHref,
	paramValues,
	removeFilterHref,
	setParamHref,
} from "./utils/search-params.js";

/** The URL read when `url` is unset: a page with nothing applied. */
const DEFAULT_URL = "/";

/** Search parameter the search field writes when `search.name` is unset. */
const DEFAULT_SEARCH_PARAM = "q";

/** Search parameter the sort menu writes when `sort.name` is unset. */
const DEFAULT_SORT_PARAM = "sort";

/** Container name the bar declares, which its zones query to wrap or collapse. */
const CONTAINER = "filter-bar";

/** Container width from which a collapsing bar shows each facet inline rather than behind "Filters". */
const COLLAPSE_WIDTH = "32rem";

/** Prop types for {@link FilterBar} and {@link FilterBarClear}. */
export namespace FilterBar {
	/** A count tab: a saved slice of the list, such as "Open 26", linked rather than filtered. */
	export interface Tab {
		label: string;
		/** Records in the slice; omitted hides the count rather than showing 0. */
		count?: number;
		/** Where the tab leads, carrying whatever other parameters the slice keeps. */
		href: string;
		/** Marks the slice the page shows with `aria-current="page"`. */
		current?: boolean;
	}

	/** One value a facet filters by. */
	export interface Option {
		/** What the facet's parameter holds when this value is applied. */
		value: string;
		label: string;
		/** Records holding this value in the current results; omitted shows no count. */
		count?: number;
		/** A glyph or status dot drawn before the label, decorative. */
		icon?: RemixNode;
	}

	/** A filterable field, written to the URL as one repeated parameter (`?status=up&status=down`). */
	export interface Facet {
		/** The search parameter this facet owns. */
		name: string;
		label: string;
		options: Option[];
		/** A glyph drawn before the label on the trigger and chip, decorative. */
		icon?: RemixNode;
	}

	/**
	 * The search field. Its input's id is `<bar id>-search`, so a list's `/` key can focus it
	 * (`<Table.Keys search="monitors-search" />`).
	 */
	export interface Search {
		/** Search parameter it writes. @default "q" */
		name?: string;
		/** Accessible name; the field shows no visible label. */
		label: string;
		placeholder?: string;
	}

	/** A sort order the menu offers. */
	export interface SortOption {
		value: string;
		label: string;
	}

	/** The sort menu: one link per order, so a choice is a navigation that keeps every filter. */
	export interface Sort {
		/** Search parameter it writes. @default "sort" */
		name?: string;
		/** The menu's accessible name, such as "Sort by". */
		label: string;
		options: SortOption[];
		/** The order the list uses while the URL names none. */
		defaultValue: string;
	}

	/** Every string the bar shows or announces. */
	export interface Labels {
		/** Accessible name of the toolbar, such as "Filter monitors". */
		toolbar: string;
		/** Accessible name of the tab navigation, such as "Monitor states". */
		tabs: string;
		/** The collapsed trigger's text, such as "Filters". */
		filters: string;
		/** The submit button in each facet's popover, such as "Apply". */
		apply: string;
		/** A chip's operator for one value, such as "is". */
		is: string;
		/** A chip's operator for several values, such as "is any of". */
		isAnyOf: string;
		/** The link that removes every filter, such as "Clear filters". */
		clear: string;
		/** The key cap beside it. @default "Esc" */
		clearKey?: string;
		/** A chip remove link's accessible name, such as `Remove Status: Down, Paused`. */
		remove: (field: string, values: string) => string;
	}

	/** Props accepted by {@link FilterBar}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children" | "id"> {
		/** Prefix for the form and popover ids; unique on the page. */
		id: string;
		/**
		 * The page's current URL, where every applied value is read from.
		 *
		 * @default "/", a page with no parameters
		 */
		url?: URL | string;
		/** Where the form submits. Defaults to the current path. */
		action?: string;
		tabs?: Tab[];
		facets?: Facet[];
		search?: Search;
		sort?: Sort;
		/** Controls at the trailing end, after sort: a `ViewOptions`, an `AutoRefresh`. */
		view?: RemixNode;
		/** Moves the facets behind one "Filters (n)" popover while the bar is narrower than 32rem. */
		collapse?: boolean;
		/** Locale for the counts. Defaults to the runtime's. */
		locale?: string;
		labels: Labels;
	}

	/** Props {@link FilterBarClear} serializes for hydration, which is why they are a `type`. */
	export type ClearProps = {
		href: string;
		label: string;
		/** The key cap printed after the label. */
		keyHint: string;
	};
}

/**
 * Renders the three-zone toolbar. Facet checkboxes, the search field and the hidden carried
 * parameters all belong to one GET form, so Apply or Enter submits the whole view and the URL
 * holds one parameter per filter; tabs, sort orders and chip removal are plain links.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the toolbar's markup.
 * @example
 * <FilterBar
 * 	id="monitors"
 * 	url={request.url}
 * 	tabs={[{ label: "Active", count: 26, href: "?state=active", current: true }]}
 * 	facets={[{ name: "status", label: "Status", options: [{ value: "down", label: "Down", count: 2 }] }]}
 * 	search={{ label: "Search monitors", placeholder: "Search…" }}
 * 	sort={{ label: "Sort by", defaultValue: "name", options: [{ value: "name", label: "Name" }] }}
 * 	labels={labels}
 * />
 */
export function FilterBar(handle: Handle<FilterBar.Props>) {
	return () => {
		let {
			id,
			url = DEFAULT_URL,
			action,
			tabs,
			facets = [],
			search,
			sort,
			view,
			collapse,
			locale,
			labels,
			mix,
			...rest
		} = handle.props;
		let formId = `${id}-form`;
		let facetsId = `${id}-facets`;
		let numbers = new Intl.NumberFormat(locale);
		let searchName = search ? (search.name ?? DEFAULT_SEARCH_PARAM) : undefined;
		let filterNames = [...facets.map((facet) => facet.name), ...(searchName ? [searchName] : [])];
		let applied = facets
			.map((facet) => ({ facet, values: paramValues(url, facet.name) }))
			.filter((entry) => entry.values.length > 0);
		let query = searchName ? (paramValues(url, searchName)[0] ?? "") : "";
		let appliedCount = applied.length + (query ? 1 : 0);

		return (
			<div
				{...rest}
				data-slot="filter-bar"
				mix={mergeMix(
					[container(CONTAINER), is("100%"), vstack({ gap: 2 }), minIs(0), text("sm")],
					mix,
				)}
			>
				<form id={formId} method="get" action={action} hidden>
					{carriedParams(url, filterNames).map(([name, value]) => (
						<input type="hidden" name={name} value={value} />
					))}
					<button type="submit" tabIndex={-1} aria-hidden="true">
						{labels.apply}
					</button>
				</form>
				<div
					role="toolbar"
					aria-label={labels.toolbar}
					data-slot="filter-bar-row"
					mix={[flex(), flexWrap(), items("center"), raw({ gap: "0.5rem 1rem" })]}
				>
					{tabs?.length ? <FilterTabs tabs={tabs} label={labels.tabs} numbers={numbers} /> : null}
					{facets.length ? (
						<div
							data-slot="filter-bar-facets"
							mix={[flex(), flexWrap(), items("center"), gap(1), minIs(0)]}
						>
							{collapse ? (
								<FacetTrigger
									popoverId={facetsId}
									label={labels.filters}
									icon={<ListFilterIcon size={16} />}
									applied={applied.length}
									collapsed
								/>
							) : null}
							<div
								id={facetsId}
								popover={collapse ? "auto" : undefined}
								data-slot="filter-bar-facet-list"
								mix={[
									collapse ? collapsibleFacets() : [flex(), flexWrap(), items("center"), gap(1)],
								]}
							>
								{facets.map((facet) => (
									<FacetTrigger
										popoverId={`${id}-facet-${facet.name}`}
										label={facet.label}
										icon={facet.icon}
										applied={paramValues(url, facet.name).length}
									/>
								))}
							</div>
							{facets.map((facet) => (
								<FacetPopover
									id={`${id}-facet-${facet.name}`}
									formId={formId}
									facet={facet}
									selected={paramValues(url, facet.name)}
									numbers={numbers}
									apply={labels.apply}
								/>
							))}
						</div>
					) : null}
					<div
						data-slot="filter-bar-end"
						mix={[
							flex(),
							items("center"),
							justify("end"),
							gap(1),
							grow(),
							basis("14rem"),
							minIs(0),
							mis("auto"),
						]}
					>
						{search ? (
							<SearchField aria-label={search.label} mix={[grow(), basis("10rem"), minIs(0)]}>
								<SearchField.Input
									id={`${id}-search`}
									name={searchName}
									form={formId}
									defaultValue={query}
									placeholder={search.placeholder}
									autocomplete="off"
									mix={[bs(8)]}
								/>
							</SearchField>
						) : null}
						{sort ? <SortMenu id={`${id}-sort`} url={url} sort={sort} /> : null}
						{view}
					</div>
				</div>
				{appliedCount > 0 ? (
					<div
						data-slot="filter-bar-chips"
						mix={[flex(), flexWrap(), items("center"), gap(2), minIs(0)]}
					>
						{applied.map(({ facet, values }) => (
							<FilterChip
								url={url}
								facet={facet}
								values={values}
								popoverId={`${id}-facet-${facet.name}`}
								labels={labels}
							/>
						))}
						{query && search && searchName ? (
							<FilterChip
								url={url}
								facet={{ name: searchName, label: search.label, options: [] }}
								values={[query]}
								labels={labels}
							/>
						) : null}
						<FilterBarClear
							href={clearFiltersHref(url, filterNames)}
							label={labels.clear}
							keyHint={labels.clearKey ?? "Esc"}
						/>
					</div>
				) : null}
			</div>
		);
	};
}

/**
 * Styles a collapsing facet list: inline in a wide bar, where its closed `popover` attribute
 * is overridden into the flow, and a floating panel anchored to "Filters" in a narrow one.
 *
 * @returns The mixins for the facet list host.
 */
function collapsibleFacets() {
	return [
		floatingSurface(),
		surfaceInset(),
		raw({
			inset: "auto",
			margin: 0,
			marginBlockStart: "0.25rem",
			positionArea: "bottom span-right",
			flexDirection: "column",
			alignItems: "stretch",
			gap: "0.25rem",
			minInlineSize: "12rem",
			"&:popover-open": { display: "flex" },
			[`@container ${CONTAINER} (min-width: ${COLLAPSE_WIDTH})`]: {
				position: "static",
				display: "flex",
				flexDirection: "row",
				flexWrap: "wrap",
				alignItems: "center",
				minInlineSize: 0,
				margin: 0,
				padding: 0,
				border: 0,
				boxShadow: "none",
				background: "transparent",
				color: "inherit",
				overflow: "visible",
			},
		}),
	];
}

/** Props for {@link FilterTabs}. */
interface FilterTabsProps {
	tabs: FilterBar.Tab[];
	label: string;
	numbers: Intl.NumberFormat;
}

/**
 * Renders the count tabs as links, the current one marked for assistive technology and drawn
 * in the emphasis ink, each count tabular so the row holds still as numbers change. Tabs that
 * outgrow the bar wrap onto more lines, each tab kept whole.
 *
 * @param handle Runtime handle carrying the tabs.
 * @returns The render function producing the navigation.
 */
function FilterTabs(handle: Handle<FilterTabsProps>) {
	return () => {
		let { tabs, label, numbers } = handle.props;
		return (
			<nav
				aria-label={label}
				data-slot="filter-bar-tabs"
				mix={[hstack({ gap: 1 }), flexWrap(), minIs(0), maxIs("100%")]}
			>
				{tabs.map((tab) => (
					<a
						href={tab.href}
						aria-current={tab.current ? "page" : undefined}
						mix={[
							interactiveTransition(),
							inlineFlex(),
							items("center"),
							gap(1.5),
							bs(8),
							pi(2),
							rounded("md"),
							fg("neutral.muted"),
							textDecoration("none"),
							nowrap(),
							hover([fg("neutral.emphasis"), bg("neutral.bg-tint-hover")]),
							focusVisible(outline({ color: "brand.ring", offset: 2 })),
							when('&[aria-current="page"]', [fg("neutral.emphasis"), weight(600)]),
						]}
					>
						{tab.label}
						{tab.count === undefined ? null : (
							<span
								data-slot="count"
								mix={[
									pi(1.5),
									rounded("full"),
									bg("neutral.tint"),
									text("xs"),
									weight(500),
									tabularNums(),
								]}
							>
								{numbers.format(tab.count)}
							</span>
						)}
					</a>
				))}
			</nav>
		);
	};
}

/** Props for {@link FacetTrigger}. */
interface FacetTriggerProps {
	popoverId: string;
	label: string;
	icon?: RemixNode;
	/** Values applied through this trigger; 0 draws the dashed empty state. */
	applied: number;
	/** Marks the "Filters" trigger that only shows while the facets are collapsed. */
	collapsed?: boolean;
}

/**
 * Renders a facet's trigger: no chrome until hovered, a dashed outline then while nothing is
 * applied, and a solid outline with the applied count once something is.
 *
 * @param handle Runtime handle carrying the trigger's props.
 * @returns The render function producing the button.
 */
function FacetTrigger(handle: Handle<FacetTriggerProps>) {
	return () => {
		let { popoverId, label, icon, applied, collapsed } = handle.props;
		return (
			<button
				type="button"
				commandfor={popoverId}
				command="toggle-popover"
				data-slot={collapsed ? "filter-bar-collapse" : "filter-bar-facet"}
				data-applied={applied > 0 ? "" : undefined}
				mix={[
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					gap(1.5),
					bs(8),
					pi(2.5),
					rounded("md"),
					border({ width: 1, style: "dashed", color: "transparent" }),
					bg("transparent"),
					fg("neutral"),
					text("sm"),
					nowrap(),
					cursor("pointer"),
					when("& > svg", [fg("neutral.muted"), shrink(0)]),
					hover([bg("neutral.bg-tint-hover"), border("neutral.border"), fg("neutral.emphasis")]),
					when("&[data-applied]", [
						border({ width: 1, style: "solid", color: "neutral.border" }),
						fg("neutral.emphasis"),
					]),
					focusVisible(outline({ color: "brand.ring", offset: 2 })),
					collapsed ? at(COLLAPSE_WIDTH, CONTAINER, hidden()) : [],
				]}
			>
				{icon}
				{label}
				{applied > 0 ? (
					<span
						data-slot="count"
						mix={[
							pi(1.5),
							rounded("full"),
							bg("brand.tint"),
							fg("brand"),
							text("xs"),
							weight(600),
							tabularNums(),
						]}
					>
						{applied}
					</span>
				) : null}
				<ChevronDownIcon size={14} />
			</button>
		);
	};
}

/** Props for {@link FacetPopover}. */
interface FacetPopoverProps {
	id: string;
	formId: string;
	facet: FilterBar.Facet;
	selected: string[];
	numbers: Intl.NumberFormat;
	apply: string;
}

/**
 * Renders a facet's value picker: a native popover holding one checkbox per value with its
 * count, and an Apply button submitting the bar's form. Tab moves from the trigger into the
 * list, Space toggles a value, and Escape closes it unchanged.
 *
 * @param handle Runtime handle carrying the facet and its applied values.
 * @returns The render function producing the popover.
 */
function FacetPopover(handle: Handle<FacetPopoverProps>) {
	return () => {
		let { id, formId, facet, selected, numbers, apply } = handle.props;
		let legendId = `${id}-legend`;
		return (
			<Popover
				id={id}
				placement="bottom-start"
				role="dialog"
				aria-labelledby={legendId}
				data-slot="filter-bar-facet-popover"
				mix={[surfaceInset(), minIs("14rem"), maxIs("min(20rem, calc(100vw - 2rem))")]}
			>
				<fieldset mix={[m(0), p(0), raw({ border: 0 }), vstack({ gap: 0.5 }), minIs(0)]}>
					<legend id={legendId} mix={[pi(2), pb(1), text("xs"), weight(600), fg("neutral.muted")]}>
						{facet.label}
					</legend>
					<div mix={[vstack({ gap: 0.5 }), maxBs("16rem"), overflowY("auto")]}>
						{facet.options.map((option) => (
							<div
								data-slot="filter-bar-option"
								mix={[
									pi(2),
									pb(1.5),
									rounded("md"),
									hover(bg("neutral.bg-tint-hover")),
									when("& label", [is("full"), cursor("pointer")]),
								]}
							>
								<Checkbox
									name={facet.name}
									value={option.value}
									form={formId}
									defaultChecked={selected.includes(option.value)}
									color="brand"
								>
									{option.icon}
									<span mix={[grow(), truncate()]}>{option.label}</span>
									{option.count === undefined ? null : (
										<span
											data-slot="count"
											mix={[mis("auto"), pis(3), fg("neutral.muted"), tabularNums()]}
										>
											{numbers.format(option.count)}
										</span>
									)}
								</Checkbox>
							</div>
						))}
					</div>
				</fieldset>
				<div mix={[flex(), justify("end"), pi(1), raw({ paddingBlockStart: "0.5rem" })]}>
					<Button type="submit" form={formId} size="sm" color="brand">
						{apply}
					</Button>
				</div>
			</Popover>
		);
	};
}

/** Props for {@link SortMenu}. */
interface SortMenuProps {
	id: string;
	url: URL | string;
	sort: FilterBar.Sort;
}

/**
 * Renders the sort trigger and its menu, one link per order with the current one checked,
 * so choosing an order keeps every filter and works as a plain navigation.
 *
 * @param handle Runtime handle carrying the sort options.
 * @returns The render function producing the trigger and menu.
 */
function SortMenu(handle: Handle<SortMenuProps>) {
	return () => {
		let { id, url, sort } = handle.props;
		let name = sort.name ?? DEFAULT_SORT_PARAM;
		let current = paramValues(url, name)[0] ?? sort.defaultValue;
		let currentLabel = sort.options.find((option) => option.value === current)?.label ?? current;
		return (
			<>
				<Button
					variant="ghost"
					size="sm"
					commandfor={id}
					command="toggle-popover"
					aria-label={`${sort.label}: ${currentLabel}`}
					data-slot="filter-bar-sort"
					mix={[shrink(0), fg("neutral"), weight(400), when("& > svg", fg("neutral.muted"))]}
				>
					<ArrowUpDownIcon size={16} />
					<span data-slot="label" mix={[hidden(), at("28rem", CONTAINER, inline())]}>
						{currentLabel}
					</span>
				</Button>
				<Menu id={id} placement="bottom-end" aria-label={sort.label}>
					{sort.options.map((option) => (
						<Menu.Item
							href={setParamHref(
								url,
								name,
								option.value === sort.defaultValue ? null : option.value,
							)}
							role="menuitemradio"
							aria-checked={option.value === current ? "true" : "false"}
							mix={[when('&[aria-checked="true"]', weight(600))]}
						>
							{option.label}
						</Menu.Item>
					))}
				</Menu>
			</>
		);
	};
}

/** Props for {@link FilterChip}. */
interface FilterChipProps {
	url: URL | string;
	facet: FilterBar.Facet;
	values: string[];
	/** The facet's picker, which the value segment reopens; unset draws the values as text. */
	popoverId?: string;
	labels: FilterBar.Labels;
}

/**
 * Renders an applied filter as a segmented chip, field · operator · values · remove, where the
 * values reopen the facet's picker and remove is a link to the URL without that parameter.
 *
 * @param handle Runtime handle carrying the facet and its applied values.
 * @returns The render function producing the chip.
 */
function FilterChip(handle: Handle<FilterChipProps>) {
	return () => {
		let { url, facet, values, popoverId, labels } = handle.props;
		let summary = values
			.map((value) => facet.options.find((option) => option.value === value)?.label ?? value)
			.join(", ");
		let operator = values.length > 1 ? labels.isAnyOf : labels.is;
		let segment = [inlineFlex(), items("center"), gap(1.5), pi(2), bs("100%"), nowrap()];
		return (
			<span
				role="group"
				aria-label={`${facet.label} ${operator} ${summary}`}
				data-slot="filter-bar-chip"
				data-name={facet.name}
				mix={[
					inlineFlex(),
					items("stretch"),
					bs(7),
					maxIs("100%"),
					minIs(0),
					rounded("md"),
					border({ width: 1, color: "neutral.border" }),
					bg("neutral.tint"),
					divide("inline", "neutral.border"),
					raw({ overflow: "hidden" }),
				]}
			>
				<span
					data-slot="field"
					mix={[
						...segment,
						fg("neutral.emphasis"),
						weight(500),
						when("& > svg", fg("neutral.muted")),
					]}
				>
					{facet.icon}
					{facet.label}
				</span>
				<span data-slot="operator" mix={[...segment, fg("neutral.muted")]}>
					{operator}
				</span>
				{popoverId ? (
					<button
						type="button"
						commandfor={popoverId}
						command="toggle-popover"
						data-slot="values"
						mix={[
							...segment,
							minIs(0),
							raw({ border: 0, font: "inherit" }),
							bg("transparent"),
							fg("neutral.emphasis"),
							cursor("pointer"),
							hover(bg("neutral.bg-tint-hover")),
							focusVisible(outline({ color: "brand.ring", offset: -2 })),
						]}
					>
						<span mix={[truncate(), maxIs("16rem")]}>{summary}</span>
					</button>
				) : (
					<span data-slot="values" mix={[...segment, minIs(0), fg("neutral.emphasis")]}>
						<span mix={[truncate(), maxIs("16rem")]}>{summary}</span>
					</span>
				)}
				<a
					href={removeFilterHref(url, facet.name)}
					aria-label={labels.remove(facet.label, summary)}
					data-slot="remove"
					mix={[
						...segment,
						pi(1.5),
						fg("neutral.muted"),
						hover([fg("neutral.emphasis"), bg("neutral.bg-tint-hover")]),
						focusVisible(outline({ color: "brand.ring", offset: -2 })),
					]}
				>
					<XIcon size={14} aria-hidden="true" />
				</a>
			</span>
		);
	};
}

/**
 * Renders "Clear filters" with its key cap. It is a link to the URL without any filter, and
 * once hydrated Escape follows it whenever nothing on the page claims the key first.
 *
 * @example <FilterBarClear href={clearFiltersHref(url, ["status", "q"])} label="Clear filters" keyHint="Esc" />
 */
export const FilterBarClear: EntryComponent<FilterBar.ClearProps> = clientEntry(
	"@sdxc/ui/app/filter-bar#FilterBarClear",
	function FilterBarClear(handle: Handle<FilterBar.ClearProps>) {
		return () => {
			let { href, label, keyHint } = handle.props;
			return (
				<a
					href={href}
					data-slot="filter-bar-clear"
					aria-keyshortcuts="Escape"
					mix={[
						escapeLink(),
						interactiveTransition(),
						inlineFlex(),
						items("center"),
						gap(2),
						bs(7),
						pi(2),
						rounded("md"),
						fg("neutral"),
						textDecoration("none"),
						nowrap(),
						hover([fg("neutral.emphasis"), bg("neutral.bg-tint-hover")]),
						focusVisible(outline({ color: "brand.ring", offset: 2 })),
					]}
				>
					{label}
					<Keyboard aria-hidden="true" mix={[raw({ marginInlineStart: 0 })]}>
						{keyHint}
					</Keyboard>
				</a>
			);
		};
	},
);
