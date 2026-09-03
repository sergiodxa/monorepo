/**
 * A tabular data display built on the native `<table>` element, with column
 * headers that become sort links and a trailing row that becomes a
 * "load more" link — both driven entirely by URLs a consumer computes, so the
 * sorted or paginated result renders back from the server with no client
 * state to track.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "@sdxc/icons";
import {
	bg,
	borderEdge,
	center,
	container,
	cursor,
	fg,
	fontSize,
	gap,
	hover,
	inlineFlex,
	is,
	items,
	opacity,
	outline,
	overflow,
	p,
	pb,
	pi,
	raw,
	relative,
	textAlign,
	textDecoration,
	userSelect,
	virtualize,
	weight,
	when,
} from "@sdxc/u";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/**
 * Named container {@link Table.Container} declares on its own host, so a
 * consumer's own descendant styles can query the wrapper's width instead of
 * the page's.
 */
const CONTAINER_NAME = "ui-table";

/** Text alignment {@link Table.Column} falls back to when `align` is omitted. */
const DEFAULT_ALIGN: Table.Align = "start";

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

	/**
	 * Every native `<table>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface Props extends TagProps<"table"> {}

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
		/** Text alignment for the header and its indicator. Defaults to {@link DEFAULT_ALIGN}. */
		align?: Align;
		/** Target URL that re-requests the table sorted by this column. Omit for an unsortable column. */
		href?: string;
		/** This column's current sort direction, when it's the active sort key. */
		sortDirection?: SortDirection;
		/** Per-part styling for the sortable header's internal elements. */
		parts?: ColumnPartsProps;
	}

	/**
	 * Every native `<tr>` attribute, unchanged, plus the `mix` passthrough.
	 * Set `aria-selected="true"` directly to mark a row selected — the row's
	 * own selection tint rides that native attribute.
	 */
	export interface RowProps extends TagProps<"tr"> {}

	/**
	 * Every native `<td>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface CellProps extends TagProps<"td"> {}

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
 * Renders the table's `<table>` host: a full-width, border-collapsed grid
 * with a small base font size, ready to hold {@link Table.Header} and
 * {@link Table.Body}. Dev mode warns when it lacks an accessible name.
 *
 * @param handle Runtime handle carrying the host `<table>`'s props.
 * @returns The render function producing the table's markup.
 * @example
 * <Table aria-label={t("subjects.title")}>
 * 	<Table.Header>
 * 		<Table.Row>
 * 			<Table.Column>{t("subjects.name")}</Table.Column>
 * 		</Table.Row>
 * 	</Table.Header>
 * 	<Table.Body>
 * 		<Table.Row>
 * 			<Table.Cell>{subject.name}</Table.Cell>
 * 		</Table.Row>
 * 	</Table.Body>
 * </Table>
 */
export function Table(handle: Handle<Table.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Table: needs an "aria-label" or "aria-labelledby" describing its contents for assistive technology.',
		);

		return (
			<table
				{...rest}
				data-slot="table"
				mix={[is("100%"), raw({ borderCollapse: "collapse" }), fontSize("sm"), mix]}
			/>
		);
	};
}

/**
 * Renders an optional wrapper around {@link Table}: a relatively positioned
 * `<div>` that scrolls its own inline axis when the table grows wider than
 * the available space, and declares the `ui-table` named container.
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
				mix={[relative(), is("100%"), overflow("auto"), container(CONTAINER_NAME), mix]}
			/>
		);
	};
};

/**
 * Renders the table's `<thead>` host: a plain wrapper for the header
 * {@link Table.Row}, separated from {@link Table.Body} by a block-end border.
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
				mix={[borderEdge("block-end", { color: "neutral", width: 1 }), mix]}
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
				mix={[
					virtualize("auto var(--ui-table-body-intrinsic-size, 32rem)"),
					when(
						"& > :not([hidden]) ~ :not([hidden])",
						borderEdge("block-start", { color: "neutral", width: 1 }),
					),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a column header inside a native `<th scope="col">`, aligned by
 * the `data-align` attribute. Setting `href` turns the label into a sort
 * link exposing `aria-sort` and a direction indicator for the active key.
 *
 * @param handle Runtime handle carrying the host `<th>`'s props.
 * @returns The render function producing the column header's markup.
 * @example
 * <Table.Column>{t("subjects.email")}</Table.Column>
 * @example
 * <Table.Column href={sortUrl("name", nextDirection)} sortDirection={activeSort === "name" ? currentDirection : undefined}>
 * 	{t("subjects.name")}
 * </Table.Column>
 */
Table.Column = function TableColumn(handle: Handle<Table.ColumnProps>) {
	return () => {
		let { align, href, sortDirection, parts, children, mix, ...rest } = handle.props;
		let resolvedAlign = align ?? DEFAULT_ALIGN;

		return (
			<th
				{...rest}
				data-align={resolvedAlign}
				aria-sort={href ? (sortDirection ?? "none") : undefined}
				data-slot="column"
				mix={[
					attrs({ scope: "col" }),
					pi("1rem"),
					pb("0.75rem"),
					textAlign("start"),
					weight(500),
					fg("neutral"),
					when('&[data-align="center"]', textAlign("center")),
					when('&[data-align="end"]', textAlign("end")),
					when("&[aria-sort]", when("&:hover", bg("neutral.tint"))),
					when("&[aria-sort]", [cursor("pointer"), userSelect()]),
					mix,
				]}
			>
				{href ? (
					<a
						href={href}
						mix={[
							when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
							inlineFlex(),
							items("center"),
							gap("0.25rem"),
							fg("inherit"),
							textDecoration("none"),
							hover(textDecoration("underline")),
							parts?.link,
						]}
					>
						{children}
						{sortDirection === "ascending" && <ArrowUpIcon size={14} />}
						{sortDirection === "descending" && <ArrowDownIcon size={14} />}
						{!sortDirection && <ArrowUpDownIcon size={14} mix={[opacity(40)]} />}
					</a>
				) : (
					children
				)}
			</th>
		);
	};
};

/**
 * Renders a native `<tr>` host: transitions its background smoothly, tints
 * it on hover, and tints it more strongly when it carries
 * `aria-selected="true"`, set directly since selection state is native.
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
				mix={[
					interactiveTransition(),
					hover(bg("neutral.tint")),
					when('&[aria-selected="true"]', bg("brand.tint")),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<td>` host, padded on every side and colored as the
 * table's emphasized foreground text.
 *
 * @param handle Runtime handle carrying the host `<td>`'s props.
 * @returns The render function producing the cell's markup.
 * @example
 * <Table.Cell>{subject.name}</Table.Cell>
 */
Table.Cell = function TableCell(handle: Handle<Table.CellProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<td
				{...rest}
				data-slot="cell"
				mix={[pi("1rem"), pb("0.75rem"), fg("neutral.emphasis"), mix]}
			/>
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
