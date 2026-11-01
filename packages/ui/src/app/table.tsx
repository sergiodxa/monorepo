/**
 * A tabular data display built on the native `<table>`: URL-driven sort headers and a
 * "load more" row, a sticky header, two row densities, a selection column, one-line row actions
 * that fold into a menu, a whole-row link, a pinned first column, typed cells and states.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, EllipsisIcon } from "@sdxc/icons";
import {
	bg,
	center,
	container,
	cursor,
	fg,
	flex,
	font,
	fontSize,
	gap,
	hidden,
	hover,
	is,
	items,
	justify,
	keyframes,
	opacity,
	outline,
	overflow,
	p,
	pb,
	pi,
	raw,
	relative,
	shrink,
	tabularNums,
	textAlign,
	textDecoration,
	truncate,
	userSelect,
	virtualize,
	weight,
	when,
} from "@sdxc/u";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix } from "@sdxc/u/general";
import { attrs, clientEntry } from "remix/component";

import type { SemanticColor } from "../utils/semantic-color.js";

import { Button } from "../components/button.js";
import { Checkbox } from "../components/checkbox.js";
import { LinkButton } from "../components/link-button.js";
import { Menu } from "../components/menu.js";
import { RelativeTime } from "../components/relative-time.js";
import { StatusDot } from "../components/status-dot.js";
import { interactiveTransition } from "../styles/interactive-transition.js";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name.js";

import type { RowNavigation } from "./mixins/row-navigation.js";

import { ROW_NAVIGATION_ATTRIBUTE, rowNavigation } from "./mixins/row-navigation.js";
import { tableSelection } from "./mixins/table-selection.js";

/**
 * Named container {@link Table.Container} declares on its own host, so a
 * consumer's own descendant styles can query the wrapper's width instead of
 * the page's.
 */
const CONTAINER_NAME = "ui-table";

/** Text alignment {@link Table.Column} falls back to when `align` is omitted. */
const DEFAULT_ALIGN: Table.Align = "start";

/**
 * Text alignment a `numeric` {@link Table.Column} falls back to when `align` is
 * omitted, lining its header up with the end-aligned figures beneath it.
 */
const DEFAULT_NUMERIC_ALIGN: Table.Align = "end";

/**
 * Flex alignment a sortable header's link takes for each column alignment, so the
 * link fills the whole cell and still places its label where `align` puts it.
 */
const JUSTIFY_BY_ALIGN = { start: "start", center: "center", end: "end" } as const;

/** Row block size for each density; compact leaves the variable to an app-wide setting. */
const ROW_BLOCK_SIZE = "var(--ui-table-row-block-size, 2.5rem)";

/** Surface behind sticky headers and pinned cells, which must be opaque to cover what scrolls under them. */
const TABLE_BG = "var(--ui-table-bg, var(--ui-bg, Canvas))";

/** Edge shadow a pinned first column casts once the table scrolls sideways. */
const PIN_SHADOW_KEYFRAMES = "ui-table-pin-shadow";

/** Characters an id cell keeps visible after the ellipsis, where ids differ most. */
const DEFAULT_ID_TAIL = 4;

/** Upper bound a data bar's value is measured against when `max` is omitted: a proportion. */
const DEFAULT_BAR_MAX = 1;

/** What a typed cell shows for a value that is unknown or missing. */
const EMPTY_VALUE = "—";

/**
 * Width of the `ui-table` container at or below which {@link Table.Actions} given an
 * `overflowLabel` shows one menu button in place of its inline actions.
 */
const ACTIONS_OVERFLOW_QUERY = "@container ui-table (max-width: 40rem)";

/** Interactive elements that sit above a whole-row link, so they keep their own clicks. */
const ROW_CONTROLS = ':is(a, button, label, select, textarea, summary, [role="button"])';

/**
 * Prop types for {@link Table} and its compound parts.
 */
export namespace Table {
	/**
	 * Text alignment for a column's header and, by convention, its cells.
	 * `"start"`/`"end"` follow the writing direction, so a column stays
	 * left- or right-aligned correctly under `dir="rtl"`.
	 */
	export type Align = "start" | "center" | "end";

	/**
	 * Current sort direction for a sortable column, matching the values the
	 * native `aria-sort` attribute accepts. Leaving it unset while `href` is
	 * set renders the column as sortable but not the active sort key.
	 */
	export type SortDirection = "ascending" | "descending";

	/** Row height: `compact` is 2.5rem for scanning, `comfortable` 3.5rem for two-line rows. */
	export type Density = "compact" | "comfortable";

	/**
	 * Every native `<table>` attribute plus layout switches. Set `aria-busy="true"` while
	 * refetching: the body dims in place so the old rows stay readable until new ones land.
	 */
	export interface Props extends TagProps<"table"> {
		/** Row height, exposed as `data-density` and `--ui-table-row-block-size`. */
		density?: Density;
		/**
		 * Keeps the first column in view while the table scrolls sideways in its container,
		 * with an edge shadow that appears once anything has scrolled beneath it.
		 */
		pinFirstColumn?: boolean;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ContainerProps extends TagProps<"div"> {}

	/**
	 * Every native `<thead>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface HeaderProps extends TagProps<"thead"> {}

	/**
	 * Every native `<tbody>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface BodyProps extends TagProps<"tbody"> {}

	/**
	 * Per-part styling for the elements a sortable {@link Table.Column} renders
	 * besides its own `<th>` host.
	 */
	export interface ColumnPartsProps {
		/** Styling for the header's inner link, rendered only when `href` is set. */
		link?: TagProps<"a">["mix"];
	}

	/**
	 * Every native `<th>` attribute, plus the `mix` passthrough. Setting
	 * `href` turns the header into a sort link exposing `aria-sort`; `align`
	 * shadows the deprecated native `align` with the logical values above.
	 */
	export interface ColumnProps extends Omit<TagProps<"th">, "align"> {
		/**
		 * Text alignment for the header and its indicator. Defaults to {@link DEFAULT_ALIGN},
		 * or {@link DEFAULT_NUMERIC_ALIGN} for a `numeric` column.
		 */
		align?: Align;
		/**
		 * Marks the column as holding numbers, exposed as `data-numeric`: the header aligns
		 * to the end unless `align` says otherwise, matching `numeric` cells beneath it.
		 */
		numeric?: boolean;
		/** Target URL that re-requests the table sorted by this column. Omit for an unsortable column. */
		href?: string;
		/** This column's current sort direction, when it's the active sort key. */
		sortDirection?: SortDirection;
		/** Per-part styling for the sortable header's internal elements. */
		parts?: ColumnPartsProps;
	}

	/**
	 * Every native `<tr>` attribute, unchanged, plus the `mix` passthrough.
	 * A row whose selection checkbox is checked, or that carries `aria-selected="true"`,
	 * is tinted as selected.
	 */
	export interface RowProps extends TagProps<"tr"> {}

	/**
	 * Every native `<td>` attribute plus the `mix` passthrough and `numeric`.
	 */
	export interface CellProps extends TagProps<"td"> {
		/**
		 * Marks the cell as a number, exposed as `data-numeric`: its figures render at
		 * tabular widths and align to the end, so digits line up down the column.
		 */
		numeric?: boolean;
	}

	/**
	 * Props accepted by {@link Table.Keys}: the row-navigation options a server can send, so
	 * everything but the announcer, which lives in the browser.
	 */
	export type KeysProps = Omit<RowNavigation.Options, "announcer" | "within">;

	/** Header cell for the selection column. */
	export interface SelectAllProps extends Omit<TagProps<"th">, "children"> {
		/** Accessible name of the select-all checkbox, such as "Select all monitors". */
		label: string;
		/** Whether every row starts selected. */
		checked?: boolean;
	}

	/** Body cell holding one row's selection checkbox. */
	export interface SelectProps extends Omit<TagProps<"td">, "children"> {
		/** The row's key, submitted as the checkbox's value. */
		value: string;
		/** Accessible name, such as "Select api.example.com". */
		label: string;
		/** Field name the checked keys submit under. */
		name?: string;
		/** Id of a `<form>` elsewhere on the page the checkbox submits with, such as a bulk-action form. */
		form?: string;
		/** Whether the row starts selected. */
		checked?: boolean;
		/** Keeps the row out of the selection and out of select-all. */
		disabled?: boolean;
	}

	/** Header cell over the row actions, holding a visually hidden name for the column. */
	export interface ActionsColumnProps extends Omit<TagProps<"th">, "children"> {
		/** The column's name for assistive technology, such as "Actions". */
		label: string;
	}

	/**
	 * Body cell holding a row's actions. Put the one most used action first and any
	 * destructive one last.
	 */
	export interface ActionsProps extends TagProps<"td"> {
		/**
		 * Name of the menu button that stands in for the actions in a narrow table, such as
		 * "More actions". Set it to fold {@link Table.Action} children into that menu.
		 */
		overflowLabel?: string;
	}

	/**
	 * One row action: a link when `href` is set, else a `<button>`, drawn as a small ghost
	 * button in the row and as a menu row in the overflow menu. `danger` tones it for a
	 * destructive action.
	 */
	export interface ActionProps extends Menu.ItemProps {}

	/** A link that makes its whole row the target; every other control in the row keeps its own click. */
	export type RowLinkProps = TagProps<"a"> & {
		/** The record's page. */
		href: string;
	};

	/** Shared props of the typed cells: every native `<td>` attribute but children. */
	export interface TypedCellProps extends Omit<TagProps<"td">, "children"> {}

	/** A number formatted through `Intl.NumberFormat` and aligned for comparison. */
	export interface NumberCellProps extends TypedCellProps {
		/** The value; `null` or `undefined` renders `—`. */
		value: number | null | undefined;
		/** BCP 47 locale. Defaults to the runtime's. */
		locale?: string;
		/** Formatting, such as `{ style: "unit", unit: "millisecond" }` or `{ style: "percent" }`. */
		format?: Intl.NumberFormatOptions;
	}

	/** An amount with its currency code muted after it, the form that reads across currencies. */
	export interface CurrencyCellProps extends TypedCellProps {
		/** The amount in major units (12.8 for $12.80); `null` or `undefined` renders `—`. */
		value: number | null | undefined;
		/** ISO 4217 code, such as `"USD"`. */
		currency: string;
		/** BCP 47 locale. Defaults to the runtime's. */
		locale?: string;
	}

	/** An identifier set in mono and truncated in the middle, keeping the end where ids differ. */
	export interface IdCellProps extends TypedCellProps {
		/** The full id, kept whole in the text and the title; `null` or `undefined` renders `—`. */
		value: string | null | undefined;
		/**
		 * Characters kept after the ellipsis, always whole: the cell outgrows
		 * `--ui-table-id-max-inline-size` as far as they need. Defaults to {@link DEFAULT_ID_TAIL}.
		 */
		tail?: number;
	}

	/** A moment shown through `RelativeTime`: relative within a week, a date after it. */
	export interface DateCellProps extends TypedCellProps {
		/** The moment; `null` or `undefined` renders `—`. */
		date: Date | string | number | null | undefined;
		/** Reference moment, so the server renders deterministically. */
		now?: Date | string | number;
		/** BCP 47 locale. */
		locale?: string;
		/** IANA zone the server formats in. Defaults to UTC. */
		timeZone?: string;
		/** Rewrites the time in the viewer's zone through the `RelativeTimeLocal` island. */
		local?: boolean;
	}

	/** A state shown as a `StatusDot` and its label. */
	export interface StatusCellProps extends Omit<TagProps<"td">, "color"> {
		/** Semantic role of the state. */
		color?: SemanticColor;
		/** Marks a state still in progress, so its dot pulses. */
		pulse?: boolean;
		/** The state's name; omit it and the cell renders `—`. */
		children?: RemixNode;
	}

	/** A number over a bar sized to its share of `max`, for comparing rows without a chart. */
	export interface BarCellProps extends TypedCellProps {
		/** The value; `null` or `undefined` renders `—`. */
		value: number | null | undefined;
		/** The value a full bar stands for. Defaults to {@link DEFAULT_BAR_MAX}. */
		max?: number;
		/** BCP 47 locale for the figure. */
		locale?: string;
		/** Formatting for the figure. */
		format?: Intl.NumberFormatOptions;
		/** The bar's role colour. Defaults to `neutral`. */
		color?: SemanticColor;
	}

	/** Any content shown when a table has no rows, rendered beside the table rather than in it. */
	export interface EmptyProps extends TagProps<"div"> {}

	/** A failure shown in place of the body, with a slot for Retry. */
	export interface ErrorProps extends TagProps<"tbody"> {
		/** Number of columns the table renders, so the message spans the full row width. */
		colSpan: number;
		/** What went wrong. */
		children: RemixNode;
		/** A Retry control, such as a link back to the same URL. */
		action?: RemixNode;
	}

	/**
	 * Per-part styling for the elements {@link Table.LoadMore} renders besides
	 * its own `<tr>` host.
	 */
	export interface LoadMorePartsProps {
		/** Styling for the `<td>` spanning the row beneath the link. */
		cell?: TagProps<"td">["mix"];
		/** Styling for the link itself. */
		link?: TagProps<"a">["mix"];
	}

	/**
	 * Every native `<tr>` attribute, plus the `mix` passthrough. `colSpan`
	 * should match the number of columns the surrounding table renders so
	 * the link spans the full row width.
	 */
	export interface LoadMoreProps extends TagProps<"tr"> {
		/** Target URL that renders the next page of results. */
		href: string;
		/** Number of columns the surrounding table renders, so the link spans the full row width. */
		colSpan: number;
		/** The link's visible label, e.g. "Load more" or "Next page". */
		children: RemixNode;
		/** Per-part styling for the row's internal cell and link. */
		parts?: LoadMorePartsProps;
	}
}

/**
 * Renders the `<table>` host: full width, border-collapsed, small text. `density` sets the row
 * height, `pinFirstColumn` keeps the first column in view with a scroll-driven edge shadow,
 * and `aria-busy="true"` dims the body while it refetches. Dev mode warns without a name.
 *
 * @param handle Runtime handle carrying the host `<table>`'s props.
 * @returns The render function producing the table's markup.
 * @example
 * <Table aria-label={t("monitors.title")} density="comfortable" pinFirstColumn>
 * 	<Table.Header>…</Table.Header>
 * 	<Table.Body>…</Table.Body>
 * </Table>
 * @example <Table aria-label={t("monitors.title")} aria-busy={refreshing ? "true" : undefined}>…</Table>
 */
export function Table(handle: Handle<Table.Props>) {
	return () => {
		let { density, pinFirstColumn, mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Table: needs an "aria-label" or "aria-labelledby" describing its contents for assistive technology.',
		);

		return (
			<table
				{...rest}
				data-slot="table"
				data-density={density}
				data-pin-first={pinFirstColumn ? "" : undefined}
				mix={mergeMix(
					[
						is("100%"),
						fontSize("sm"),
						keyframes(PIN_SHADOW_KEYFRAMES, { from: { opacity: 0 }, to: { opacity: 1 } }),
						raw({
							borderCollapse: "collapse",
							'&[data-density="compact"]': { "--ui-table-row-block-size": "2.5rem" },
							'&[data-density="comfortable"]': { "--ui-table-row-block-size": "3.5rem" },
							/**
							 * Compact rows keep one line per cell, so every row stays the same height and a
							 * long value widens its column, scrolling the table inside its container.
							 */
							'&:not([data-density="comfortable"]) > * > tr > *': { whiteSpace: "nowrap" },
							"& > tbody": { transition: "opacity 200ms ease-out" },
							'&[aria-busy="true"] > tbody': { opacity: 0.5 },
							"@media (prefers-reduced-motion: reduce)": { "& > tbody": { transition: "none" } },
							"&[data-pin-first] > tbody > tr > :first-child": {
								position: "sticky",
								insetInlineStart: 0,
								zIndex: 1,
								backgroundColor: TABLE_BG,
								backgroundImage:
									"linear-gradient(var(--ui-table-row-tint, transparent), var(--ui-table-row-tint, transparent))",
							},
							"&[data-pin-first] > * > tr > :first-child::after": {
								content: '""',
								position: "absolute",
								insetBlock: 0,
								insetInlineStart: "100%",
								inlineSize: "0.75rem",
								pointerEvents: "none",
								opacity: 0,
								backgroundImage:
									"linear-gradient(to var(--ui-table-pin-shadow-direction, right), color-mix(in oklab, var(--ui-fg, CanvasText) 14%, transparent), transparent)",
							},
							"&[data-pin-first]:dir(rtl)": { "--ui-table-pin-shadow-direction": "left" },
							"@supports (animation-timeline: scroll())": {
								"&[data-pin-first] > * > tr > :first-child::after": {
									animationName: PIN_SHADOW_KEYFRAMES,
									animationDuration: "auto",
									animationTimingFunction: "linear",
									animationFillMode: "both",
									animationTimeline: "scroll(nearest inline)",
									animationRange: "0 1rem",
								},
							},
						}),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * Renders the scrolling wrapper around {@link Table}: the table scrolls sideways inside it
 * instead of widening the page, and the header sticks to its own top edge, whatever sticky offset
 * the page around it sets. Give it a `max-block-size` to scroll rows inside it; the `ui-table`
 * container is declared here.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the wrapper's markup.
 * @example
 * <Table.Container>
 * 	<Table aria-label={t("subjects.title")}>...</Table>
 * </Table.Container>
 */
Table.Container = function TableContainer(handle: Handle<Table.ContainerProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="container"
				mix={mergeMix(
					[
						relative(),
						is("100%"),
						overflow("auto"),
						container(CONTAINER_NAME),
						raw({ "--ui-app-sticky-top": "0px" }),
						when(
							`& [${ROW_NAVIGATION_ATTRIBUTE}]:focus-visible`,
							outline({ color: "brand.ring", width: 2, offset: -2 }),
						),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders the `<thead>` host, whose header cells stick at `--ui-app-sticky-top` (below an app's
 * own sticky bar) over an opaque surface, ruled from the body by an inset line that stays with
 * them as they stick.
 *
 * @param handle Runtime handle carrying the host `<thead>`'s props.
 * @returns The render function producing the header section's markup.
 * @example
 * <Table.Header>
 * 	<Table.Row>
 * 		<Table.Column>{t("subjects.name")}</Table.Column>
 * 	</Table.Row>
 * </Table.Header>
 */
Table.Header = function TableHeader(handle: Handle<Table.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<thead
				{...rest}
				data-slot="header"
				mix={mergeMix(
					raw({
						"& > tr > th": {
							position: "sticky",
							insetBlockStart: "var(--ui-app-sticky-top, 0px)",
							zIndex: 2,
							backgroundColor: TABLE_BG,
							boxShadow: "inset 0 -1px 0 var(--ui-neutral-border)",
						},
						"[data-pin-first] > & > tr > th:first-child": { insetInlineStart: 0, zIndex: 3 },
					}),
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders the table's `<tbody>` host: a block-start border rules the space
 * between direct row children, and `content-visibility: auto` lets a long
 * body's off-screen rows skip layout and paint until they scroll into view.
 *
 * @param handle Runtime handle carrying the host `<tbody>`'s props.
 * @returns The render function producing the body section's markup.
 * @example
 * <Table.Body>
 * 	{subjects.map((subject) => (
 * 		<Table.Row key={subject.id}>
 * 			<Table.Cell>{subject.name}</Table.Cell>
 * 		</Table.Row>
 * 	))}
 * </Table.Body>
 */
Table.Body = function TableBody(handle: Handle<Table.BodyProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<tbody
				{...rest}
				data-slot="body"
				mix={mergeMix(
					[
						virtualize("auto var(--ui-table-body-intrinsic-size, 32rem)"),
						raw({
							"& > :not([hidden]) ~ :not([hidden])": {
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							},
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders a column header inside a native `<th scope="col">`, aligned by `data-align`.
 * Setting `href` makes the header a cell-filling sort link with `aria-sort` and a direction
 * indicator held square, so a header narrow enough to squeeze the link keeps both arrows legible.
 *
 * @param handle Runtime handle carrying the host `<th>`'s props.
 * @returns The render function producing the column header's markup.
 * @example
 * <Table.Column>{t("subjects.email")}</Table.Column>
 * @example
 * <Table.Column numeric>{t("invoices.amount")}</Table.Column>
 * @example
 * <Table.Column href={sortUrl("name", nextDirection)} sortDirection={activeSort === "name" ? currentDirection : undefined}>
 * 	{t("subjects.name")}
 * </Table.Column>
 */
Table.Column = function TableColumn(handle: Handle<Table.ColumnProps>) {
	return () => {
		let { align, numeric, href, sortDirection, parts, children, mix, ...rest } = handle.props;
		let resolvedAlign = align ?? (numeric ? DEFAULT_NUMERIC_ALIGN : DEFAULT_ALIGN);

		return (
			<th
				{...rest}
				data-align={resolvedAlign}
				data-numeric={numeric ? "" : undefined}
				aria-sort={href ? (sortDirection ?? "none") : undefined}
				data-slot="column"
				mix={mergeMix(
					[
						attrs({ scope: "col" }),
						href ? undefined : [pi("1rem"), pb("0.25rem")],
						textAlign("start"),
						weight(500),
						fg("neutral"),
						raw({ whiteSpace: "nowrap" }),
						when('&[data-align="center"]', textAlign("center")),
						when('&[data-align="end"]', textAlign("end")),
						when(
							"&[aria-sort]:hover",
							bg({
								image: "linear-gradient(var(--ui-neutral-bg-tint), var(--ui-neutral-bg-tint))",
							}),
						),
						when("&[aria-sort]", [cursor("pointer"), userSelect()]),
					],
					mix,
				)}
			>
				{href ? (
					<a
						href={href}
						mix={[
							when("&:focus-visible", outline({ color: "brand.ring", offset: -2 })),
							flex(),
							justify(JUSTIFY_BY_ALIGN[resolvedAlign]),
							pi("1rem"),
							pb("0.25rem"),
							items("center"),
							gap("0.25rem"),
							fg("inherit"),
							textDecoration("none"),
							hover(textDecoration("underline")),
							parts?.link,
						]}
					>
						{children}
						{sortDirection === "ascending" && <ArrowUpIcon size={14} mix={[shrink()]} />}
						{sortDirection === "descending" && <ArrowDownIcon size={14} mix={[shrink()]} />}
						{!sortDirection && <ArrowUpDownIcon size={14} mix={[shrink(), opacity(40)]} />}
					</a>
				) : (
					children
				)}
			</th>
		);
	};
};

/**
 * Renders a native `<tr>` host at the density's block size. It tints on hover and when
 * selected, through a checked selection checkbox or `aria-selected="true"`; a row holding a
 * {@link Table.RowLink} positions itself so the link covers it, with its other controls above.
 *
 * @param handle Runtime handle carrying the host `<tr>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Table.Row>
 * 	<Table.Cell>{subject.name}</Table.Cell>
 * </Table.Row>
 * @example
 * <Table.Row aria-selected="true">
 * 	<Table.Cell>{subject.name}</Table.Cell>
 * </Table.Row>
 */
Table.Row = function TableRow(handle: Handle<Table.RowProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<tr
				{...rest}
				data-slot="row"
				mix={mergeMix(
					[
						interactiveTransition(),
						raw({
							blockSize: ROW_BLOCK_SIZE,
							backgroundColor: "var(--ui-table-row-tint, transparent)",
							":is(thead) > &": { blockSize: "var(--ui-table-header-block-size, 2.5rem)" },
							":is(tbody) > &:hover": { "--ui-table-row-tint": "var(--ui-neutral-bg-tint)" },
							'&[aria-selected="true"], &:has([data-selection-item]:checked)': {
								"--ui-table-row-tint": "var(--ui-brand-bg-tint)",
							},
							'&:has([data-slot="row-link"])': { position: "relative" },
							[`&:has([data-slot="row-link"]) ${ROW_CONTROLS}:not([data-slot="row-link"])`]: {
								position: "relative",
								zIndex: 1,
							},
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders a native `<td>` host, padded on every side and colored as the
 * table's emphasized foreground text; a `numeric` cell end-aligns tabular figures.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell's markup.
 * @example
 * <Table.Cell>{subject.name}</Table.Cell>
 * @example
 * <Table.Cell numeric>{formatCurrency(invoice.amount)}</Table.Cell>
 */
Table.Cell = function TableCell(handle: Handle<Table.CellProps>) {
	return () => {
		let { numeric, mix, ...rest } = handle.props;

		return (
			<td
				{...rest}
				data-numeric={numeric ? "" : undefined}
				data-slot="cell"
				mix={mergeMix(
					[
						pi("1rem"),
						pb("0.25rem"),
						fg("neutral.emphasis"),
						when("&[data-numeric]", [tabularNums(), textAlign("end")]),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Client island the select-all header carries: a hidden marker whose mixin keeps the table's
 * selection checkboxes in step. Loads from `@sdxc/ui/app/table#TableSelection` once the app's
 * browser entry maps it; until then every row checkbox still works on its own.
 */
export const TableSelection: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/app/table#TableSelection",
	function TableSelection() {
		return () => <span mix={[hidden(), tableSelection()]} />;
	},
);

/** Selector for the box {@link TableKeys} walks: the table's container, or the table itself. */
const TABLE_KEYS_SCOPE = '[data-slot="container"], table';

/**
 * Client island behind {@link Table.Keys}: a hidden marker whose `rowNavigation()` walks the
 * rows of the container it sits in. Loads from `@sdxc/ui/app/table#TableKeys` once the app's
 * browser entry maps it; until then every row link and checkbox stays reachable by Tab.
 */
export const TableKeys: EntryComponent<Table.KeysProps> = clientEntry(
	"@sdxc/ui/app/table#TableKeys",
	function TableKeys(handle: Handle<Table.KeysProps>) {
		return () => (
			<span mix={[hidden(), rowNavigation({ ...handle.props, within: TABLE_KEYS_SCOPE })]} />
		);
	},
);

/**
 * Turns on keyboard row navigation for a server-rendered table: `j`/`k` and the arrows move
 * through the rows with an inset ring, Enter or `o` opens the row's link, `x` toggles its
 * checkbox and `/` focuses the search field. Place it inside `Table.Container`, beside the table.
 *
 * @param handle Runtime handle carrying the keys' options.
 * @returns The render function producing the island.
 * @example <Table.Container><Table.Keys search="q" labels={{ group: t("keys.list"), next: t("keys.next") }} /><Table>…</Table></Table.Container>
 */
Table.Keys = function TableKeysPart(handle: Handle<Table.KeysProps>) {
	return () => <TableKeys {...handle.props} />;
};

/**
 * Renders the selection column's header: a select-all checkbox marked `data-selection-all`,
 * and the {@link TableSelection} island that makes it check every row, show indeterminate
 * while some are, and lets shift-click check a range.
 *
 * @param handle Runtime handle carrying the host `<th>`'s props.
 * @returns The render function producing the header cell.
 * @example <Table.SelectAll label={t("monitors.selectAll")} />
 */
Table.SelectAll = function TableSelectAll(handle: Handle<Table.SelectAllProps>) {
	return () => {
		let { label, checked, mix, ...rest } = handle.props;

		return (
			<th
				{...rest}
				data-slot="selection-column"
				mix={mergeMix([attrs({ scope: "col" }), is("1%"), pi("1rem"), pb("0.25rem")], mix)}
			>
				<Checkbox aria-label={label} checked={checked} data-selection-all="" />
				<TableSelection />
			</th>
		);
	};
};

/**
 * Renders one row's selection checkbox, marked `data-selection-item` with the row's key as its
 * value, so it submits with a form and any selection bar can count it.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example <Table.Select name="monitor" value={monitor.id} label={t("monitors.select", { name: monitor.name })} form="bulk" />
 */
Table.Select = function TableSelect(handle: Handle<Table.SelectProps>) {
	return () => {
		let { value, label, name, form, checked, disabled, mix, ...rest } = handle.props;

		return (
			<td
				{...rest}
				data-slot="selection-cell"
				mix={mergeMix([is("1%"), pi("1rem"), pb("0.25rem")], mix)}
			>
				<Checkbox
					aria-label={label}
					name={name}
					value={value}
					form={form}
					checked={checked}
					disabled={disabled}
					data-selection-item=""
				/>
			</td>
		);
	};
};

/**
 * Renders the header over the row actions with its name visually hidden, since the buttons
 * beneath name themselves.
 *
 * @param handle Runtime handle carrying the host `<th>`'s props.
 * @returns The render function producing the header cell.
 * @example <Table.ActionsColumn label={t("monitors.actions")} />
 */
Table.ActionsColumn = function TableActionsColumn(handle: Handle<Table.ActionsColumnProps>) {
	return () => {
		let { label, mix, ...rest } = handle.props;

		return (
			<th
				{...rest}
				data-slot="actions-column"
				mix={mergeMix([attrs({ scope: "col" }), is("1%")], mix)}
			>
				<span mix={[visuallyHidden()]}>{label}</span>
			</th>
		);
	};
};

/**
 * Marks the actions it wraps as the overflow menu's copy, so each {@link Table.Action} inside
 * renders as a menu row.
 *
 * @param handle Runtime handle carrying the menu's actions.
 * @returns The render function passing the actions through.
 */
function TableActionsMenu(handle: Handle<{ children?: RemixNode }, { menu: true }>) {
	handle.context.set({ menu: true });
	return () => handle.props.children;
}

/**
 * Renders a row's actions, end-aligned on one line in a cell as wide as they are, so the
 * flexible columns give way first. With `overflowLabel`, a `ui-table` container 40rem wide or
 * narrower shows a ⋯ button opening a native popover menu of the same actions instead. Where the
 * pointer can hover they stay hidden until the row is hovered, focused within, selected or has a
 * menu open; on touch they always show.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example
 * <Table.Actions overflowLabel={t("posts.moreActions")}>
 * 	<Table.Action href={editUrl}>{t("posts.edit")}</Table.Action>
 * 	<Table.Action danger commandfor="confirm-delete" command="show-modal">{t("posts.delete")}</Table.Action>
 * </Table.Actions>
 * @example
 * <Table.Actions>
 * 	<Button size="sm" variant="ghost">{t("monitors.pause")}</Button>
 * </Table.Actions>
 */
Table.Actions = function TableActions(handle: Handle<Table.ActionsProps>) {
	return () => {
		let { overflowLabel, children, mix, ...rest } = handle.props;
		let menuId = `${handle.id}-menu`;

		return (
			<td
				{...rest}
				data-slot="row-actions"
				mix={mergeMix(
					[
						is("1%"),
						pi("0.5rem"),
						pb("0.25rem"),
						raw({
							whiteSpace: "nowrap",
							transition: "opacity 150ms ease-out",
							"@media (hover: hover)": {
								opacity: 0,
								':is(tr:hover, tr:focus-within, tr[aria-selected="true"], tr:has(:popover-open)) > &':
									{ opacity: 1 },
							},
							"@media (prefers-reduced-motion: reduce)": { transition: "none" },
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="row-actions-inline"
					mix={[
						flex(),
						items("center"),
						justify("end"),
						gap("0.25rem"),
						overflowLabel ? raw({ [ACTIONS_OVERFLOW_QUERY]: { display: "none" } }) : undefined,
					]}
				>
					{children}
				</div>
				{overflowLabel ? (
					<>
						<div
							data-slot="row-actions-overflow"
							mix={[
								justify("end"),
								raw({ display: "none", [ACTIONS_OVERFLOW_QUERY]: { display: "flex" } }),
							]}
						>
							<Button
								size="sm"
								variant="ghost"
								color="neutral"
								commandfor={menuId}
								command="toggle-popover"
								aria-label={overflowLabel}
							>
								<EllipsisIcon size={16} />
							</Button>
						</div>
						<TableActionsMenu>
							<Menu id={menuId} placement="bottom-end" aria-label={overflowLabel}>
								{children}
							</Menu>
						</TableActionsMenu>
					</>
				) : null}
			</td>
		);
	};
};

/**
 * Renders one row action as a small neutral ghost button, or a danger one with `danger`; inside
 * the overflow menu of {@link Table.Actions} it renders as a menu row instead, so an app writes
 * each action once and both forms carry it.
 *
 * @param handle Runtime handle carrying the host `<a>`/`<button>`'s props.
 * @returns The render function producing the action.
 * @example <Table.Action href={href("posts.edit", { id })}>{t("posts.edit")}</Table.Action>
 * @example <Table.Action danger commandfor="confirm-delete" command="show-modal">{t("posts.delete")}</Table.Action>
 */
Table.Action = function TableAction(handle: Handle<Table.ActionProps>) {
	return () => {
		let inMenu = handle.context.get(TableActionsMenu) as { menu: true } | undefined;
		if (inMenu) return <Menu.Item {...handle.props} />;

		let { href, target, rel, danger, mix, ...rest } = handle.props;
		let color: SemanticColor = danger ? "danger" : "neutral";

		if (href) {
			/**
			 * `rest`'s fields (aria-*, data-*, id, event props, …) are all valid on an `<a>` too;
			 * `type` and `role` are left to the link.
			 */
			let { type: _type, ...anchorRest } = rest as unknown as Omit<
				TagProps<"a">,
				"href" | "target" | "rel" | "role"
			> & {
				type?: string;
			};
			return (
				<LinkButton
					{...anchorRest}
					href={href}
					target={target}
					rel={rel}
					size="sm"
					variant="ghost"
					color={color}
					mix={mix as TagProps<"a">["mix"]}
				/>
			);
		}

		return (
			<Button
				type="button"
				{...rest}
				size="sm"
				variant="ghost"
				color={color}
				mix={mix as TagProps<"button">["mix"]}
			/>
		);
	};
};

/**
 * Renders the link to a row's record, usually the name in the first cell; its hit area covers
 * the whole row, and its focus ring outlines the row. In a pinned first column the target
 * stays within that cell, since the pinned cell anchors the link's overlay.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the link.
 * @example <Table.Cell><Table.RowLink href={href("monitors.show", { id })}>{monitor.name}</Table.RowLink></Table.Cell>
 */
Table.RowLink = function TableRowLink(handle: Handle<Table.RowLinkProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<a
				{...rest}
				data-slot="row-link"
				mix={mergeMix(
					[
						fg("inherit"),
						weight(500),
						textDecoration("none"),
						hover(textDecoration("underline")),
						raw({
							outline: "none",
							"&::after": { content: '""', position: "absolute", inset: 0 },
							"&:focus-visible::after": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Draws `—` muted, the one mark for an unknown value, so a blank never reads as zero.
 *
 * @returns The render function producing the dash.
 */
function EmptyValue() {
	return () => (
		<span data-slot="empty-value" mix={[fg("neutral.muted")]}>
			{EMPTY_VALUE}
		</span>
	);
}

/**
 * Renders a number through `Intl.NumberFormat`, end-aligned in tabular figures.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example <Table.NumberCell value={monitor.p95} locale={locale} format={{ style: "unit", unit: "millisecond" }} />
 * @example <Table.NumberCell value={monitor.uptime} locale={locale} format={{ style: "percent", maximumFractionDigits: 2 }} />
 */
Table.NumberCell = function TableNumberCell(handle: Handle<Table.NumberCellProps>) {
	return () => {
		let { value, locale, format, ...rest } = handle.props;

		return (
			<Table.Cell {...rest} numeric data-type="number">
				{value === null || value === undefined ? (
					<EmptyValue />
				) : (
					new Intl.NumberFormat(locale, format).format(value)
				)}
			</Table.Cell>
		);
	};
};

/**
 * Renders an amount in its currency's symbol with the ISO code muted after it ("€123.00 EUR"),
 * end-aligned in tabular figures so amounts in mixed currencies still line up.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example <Table.CurrencyCell value={payment.amount / 100} currency={payment.currency} locale={locale} />
 */
Table.CurrencyCell = function TableCurrencyCell(handle: Handle<Table.CurrencyCellProps>) {
	return () => {
		let { value, currency, locale, ...rest } = handle.props;

		return (
			<Table.Cell {...rest} numeric data-type="currency">
				{value === null || value === undefined ? (
					<EmptyValue />
				) : (
					<span mix={[raw({ whiteSpace: "nowrap" })]}>
						{new Intl.NumberFormat(locale, {
							style: "currency",
							currency,
							currencyDisplay: "narrowSymbol",
						}).format(value)}
						<span
							data-slot="currency-code"
							mix={[fg("neutral.muted"), raw({ marginInlineStart: "0.375em" })]}
						>
							{currency.toUpperCase()}
						</span>
					</span>
				)}
			</Table.Cell>
		);
	};
};

/**
 * Renders an id in mono, ellipsised in the middle so its last characters stay visible. The
 * whole id stays in the text, so it reads aloud, copies and searches whole, and in the title.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example <Table.IdCell value={payment.id} />
 */
Table.IdCell = function TableIdCell(handle: Handle<Table.IdCellProps>) {
	return () => {
		let { value, tail, ...rest } = handle.props;
		let keep = Math.max(0, tail ?? DEFAULT_ID_TAIL);
		let kept = value && value.length > keep ? keep : 0;

		return (
			<Table.Cell {...rest} data-type="id">
				{value === null || value === undefined || value === "" ? (
					<EmptyValue />
				) : (
					<span
						data-slot="id"
						title={value}
						mix={[
							flex(),
							font("mono"),
							fontSize("xs"),
							fg("neutral"),
							/**
							 * The cap yields to the tail plus one character for the head's ellipsis,
							 * so a long tail stays whole and the head truncates first.
							 */
							raw({
								maxInlineSize: `max(var(--ui-table-id-max-inline-size, 14ch), ${kept + 1}ch)`,
							}),
						]}
					>
						<span mix={[truncate(), raw({ minInlineSize: kept > 0 ? "1ch" : 0 })]}>
							{value.length > keep ? value.slice(0, value.length - keep) : value}
						</span>
						{value.length > keep && keep > 0 ? (
							<span mix={[shrink(0), raw({ whiteSpace: "pre" })]}>{value.slice(-keep)}</span>
						) : null}
					</span>
				)}
			</Table.Cell>
		);
	};
};

/**
 * Renders a moment through `RelativeTime`: "2m ago" within a week, a date after it, the exact
 * local and UTC time in its title.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example <Table.DateCell date={monitor.checkedAt} now={requestTime} locale={locale} local />
 */
Table.DateCell = function TableDateCell(handle: Handle<Table.DateCellProps>) {
	return () => {
		let { date, now, locale, timeZone, local, ...rest } = handle.props;

		return (
			<Table.Cell {...rest} data-type="date">
				{date === null || date === undefined ? (
					<EmptyValue />
				) : (
					<RelativeTime
						date={date}
						now={now}
						locale={locale}
						timeZone={timeZone}
						local={local}
						mix={[fg("neutral"), raw({ whiteSpace: "nowrap" })]}
					/>
				)}
			</Table.Cell>
		);
	};
};

/**
 * Renders a state as a `StatusDot` and its label.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example <Table.StatusCell color="success">{t("monitor.up")}</Table.StatusCell>
 */
Table.StatusCell = function TableStatusCell(handle: Handle<Table.StatusCellProps>) {
	return () => {
		let { color, pulse, children, ...rest } = handle.props;
		let empty = children === null || children === undefined || children === false;

		return (
			<Table.Cell {...rest} data-type="status">
				{empty ? (
					<EmptyValue />
				) : (
					<StatusDot color={color} pulse={pulse}>
						{children}
					</StatusDot>
				)}
			</Table.Cell>
		);
	};
};

/**
 * Renders a figure over a bar sized to `value / max`, so the column reads as a bar chart
 * while every figure stays exact. The bar is decorative; the figure carries the value.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell.
 * @example <Table.BarCell value={route.requests} max={busiest} locale={locale} />
 */
Table.BarCell = function TableBarCell(handle: Handle<Table.BarCellProps>) {
	return () => {
		let { value, max, locale, format, color, ...rest } = handle.props;
		let share =
			value === null || value === undefined
				? 0
				: Math.min(1, Math.max(0, value / (max ?? DEFAULT_BAR_MAX)));

		return (
			<Table.Cell {...rest} numeric data-type="bar">
				{value === null || value === undefined ? (
					<EmptyValue />
				) : (
					<span
						data-slot="bar"
						data-color={color ?? "neutral"}
						mix={[
							relative(),
							flex(),
							justify("end"),
							raw({
								isolation: "isolate",
								paddingInline: "0.375rem",
								minInlineSize: "var(--ui-table-bar-min-inline-size, 6rem)",
							}),
						]}
					>
						<span
							aria-hidden="true"
							data-slot="bar-fill"
							mix={[
								raw({
									position: "absolute",
									insetBlock: "-0.125rem",
									insetInlineStart: 0,
									inlineSize: `${(share * 100).toFixed(2)}%`,
									zIndex: -1,
									borderRadius: "var(--ui-radius-sm, 0.25rem)",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									'[data-color="brand"] > &': { backgroundColor: "var(--ui-brand-bg-tint)" },
									'[data-color="success"] > &': { backgroundColor: "var(--ui-success-bg-tint)" },
									'[data-color="warning"] > &': { backgroundColor: "var(--ui-warning-bg-tint)" },
									'[data-color="danger"] > &': { backgroundColor: "var(--ui-danger-bg-tint)" },
								}),
							]}
						/>
						{new Intl.NumberFormat(locale, format).format(value)}
					</span>
				)}
			</Table.Cell>
		);
	};
};

/**
 * Renders what a table with no rows shows: any content, laid out beneath the table's header
 * and outside the `<table>`, so the column names stay as context for what is missing.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the slot.
 * @example
 * <Table.Container>
 * 	<Table aria-label={t("monitors.title")}><Table.Header>…</Table.Header></Table>
 * 	<Table.Empty><Empty>…</Empty></Table.Empty>
 * </Table.Container>
 */
Table.Empty = function TableEmpty(handle: Handle<Table.EmptyProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="table-empty"
				mix={mergeMix([raw({ paddingBlock: "2.5rem", paddingInline: "1rem" })], mix)}
			/>
		);
	};
};

/**
 * Renders a failure in place of {@link Table.Body}: the message and a Retry slot centred
 * across every column, announced as an alert, so the header and the page around it stay put.
 *
 * @param handle Runtime handle carrying the host `<tbody>`'s props.
 * @returns The render function producing the body.
 * @example
 * <Table.Error colSpan={6} action={<LinkButton href={currentUrl}>{t("retry")}</LinkButton>}>
 * 	{t("monitors.loadFailed")}
 * </Table.Error>
 */
Table.Error = function TableError(handle: Handle<Table.ErrorProps>) {
	return () => {
		let { colSpan, children, action, mix, ...rest } = handle.props;

		return (
			<tbody {...rest} data-slot="error" mix={[mix]}>
				<tr>
					<td colSpan={colSpan} mix={[p("0")]}>
						<div
							role="alert"
							mix={[
								flex(),
								items("center"),
								justify("center"),
								gap("0.75rem"),
								fg("neutral"),
								raw({
									flexWrap: "wrap",
									paddingBlock: "2rem",
									paddingInline: "1rem",
									textAlign: "center",
								}),
							]}
						>
							<span>{children}</span>
							{action}
						</div>
					</td>
				</tr>
			</tbody>
		);
	};
};

/**
 * Renders a trailing row carrying a single link that spans every column,
 * standing in for an auto-loading "next page" trigger since fetching more
 * rows without a full navigation requires script a consumer attaches.
 *
 * @param handle Runtime handle carrying the host `<tr>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Table.LoadMore href={nextPageUrl} colSpan={4}>
 * 	{t("subjects.loadMore")}
 * </Table.LoadMore>
 */
Table.LoadMore = function TableLoadMore(handle: Handle<Table.LoadMoreProps>) {
	return () => {
		let { href, colSpan, parts, children, mix, ...rest } = handle.props;

		return (
			<tr {...rest} data-slot="load-more" mix={[mix]}>
				<td colSpan={colSpan} mix={[p("0"), parts?.cell]}>
					<a
						href={href}
						mix={[
							when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
							center(),
							pb("1rem"),
							fg("neutral.muted"),
							hover(fg("neutral")),
							fontSize("sm"),
							textDecoration("none"),
							parts?.link,
						]}
					>
						{children}
					</a>
				</td>
			</tr>
		);
	};
};
