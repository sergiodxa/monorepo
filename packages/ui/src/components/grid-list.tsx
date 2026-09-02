/**
 * An interactive row list built from plain, already-ordered markup: each
 * {@link GridList.Item} carries a stable key a paired selection,
 * keyboard-navigation, or reorder behavior can read, while the list itself
 * renders as a fully static document by default. {@link GridList.Section}
 * groups related rows under an optional {@link GridList.Header} label,
 * {@link GridList.LoadMoreItem} holds a trailing loading placeholder, and
 * {@link GridList.DragHandle} marks the one element inside a row a
 * pointer-driven reorder behavior may grab.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { GripVerticalIcon } from "@pkg/lucide-remix";
import { bg, borderEdge, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor } from "@pkg/u/general";
import {
	container,
	flex,
	flexCol,
	gap,
	grid,
	gridTemplate,
	items,
	virtualize,
} from "@pkg/u/layout";
import { at } from "@pkg/u/responsive";
import { mbs, pb, pbs, pi } from "@pkg/u/size";
import { active, data, hover, not, when } from "@pkg/u/state";
import { text, textTransform, tracking, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import { panelChrome } from "../styles/panel-chrome";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { SentinelRow } from "./sentinel-row";

/**
 * Named container {@link GridList} declares on its own host, so its inner
 * row-list wrapper can react to the list's own width — switching a `"grid"`
 * layout's column count, in particular.
 */
const CONTAINER_NAME = "ui-grid-list";

/** Arrangement {@link GridList} falls back to when `layout` is omitted. */
const DEFAULT_LAYOUT: GridList.Layout = "stack";

/** `role="grid"` applied to {@link GridList} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_ROLE = "grid";

/** `role="row"` applied to {@link GridList.Item} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_ITEM_ROLE = "row";

/**
 * Tab stop {@link GridList.Item} falls back to when no explicit `tabIndex` is
 * set, so every row stays individually reachable in ordinary Tab order
 * before a keyboard-navigation behavior collapses the list to one stop.
 */
const DEFAULT_ITEM_TAB_INDEX = 0;

/** `role="rowgroup"` applied to {@link GridList.Section} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_SECTION_ROLE = "rowgroup";

/** `role="gridcell"` applied to {@link GridList.DragHandle} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_DRAG_HANDLE_ROLE = "gridcell";

/**
 * Marker {@link GridList.DragHandle} always carries as `data-drag-handle`
 * via {@link attrs} unless overridden, so a reorder behavior can tell where
 * within the row a drag gesture should originate.
 */
const DEFAULT_DRAG_HANDLE_MARKER = true;

/**
 * Prop types for {@link GridList} and its compound parts.
 */
export namespace GridList {
	/**
	 * Arrangement of {@link GridList.Item} rows: `"stack"` renders them as a
	 * single column, `"grid"` wraps them into a multi-column layout growing
	 * from two columns up to four as the list's own container widens.
	 */
	export type Layout = "stack" | "grid";

	/**
	 * Per-part styling for the elements {@link GridList} renders besides its
	 * own host.
	 */
	export interface PartsProps {
		/**
		 * Styling for the inner wrapper that switches between the `"stack"`
		 * and `"grid"` layouts and virtualizes a long list through
		 * `content-visibility: auto`.
		 */
		list?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link GridList}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Row arrangement. Defaults to {@link DEFAULT_LAYOUT}. */
		layout?: Layout;
		/** {@link GridList.Item}, {@link GridList.Section}, and {@link GridList.LoadMoreItem} rows to render. */
		children: RemixNode;
		/** Per-part styling for the list's internal row-list wrapper. */
		parts?: PartsProps;
	}

	/**
	 * Props accepted by {@link GridList.Item}.
	 */
	export interface ItemProps extends TagProps<"div"> {
		/**
		 * Stable identifier for this row, mirrored onto both the rendered
		 * element's own `id` and a `data-rmx-key` attribute, so the row is already
		 * correlation-ready for a paired behavior once one is attached.
		 */
		id: string;
	}

	/**
	 * Props accepted by {@link GridList.Section}.
	 */
	export interface SectionProps extends TagProps<"div"> {
		/** The section's optional {@link GridList.Header} label, followed by its {@link GridList.Item} rows. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link GridList.Header}.
	 */
	export interface HeaderProps extends TagProps<"header"> {}

	/**
	 * Props accepted by {@link GridList.LoadMoreItem}.
	 */
	export interface LoadMoreItemProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link GridList.DragHandle}: every native `<button>`
	 * attribute except `type`, fixed to `"button"` so it never submits an
	 * enclosing form, and `children`, fixed to the handle's own grip glyph.
	 */
	export interface DragHandleProps extends Omit<TagProps<"button">, "type" | "children"> {
		/** Accessible name for the icon-only control, e.g. "Reorder" or "Drag to reorder". */
		"aria-label": string;
	}
}

/**
 * Renders the list's root host as a bordered `<div>` with `role="grid"`,
 * keeping its row-list layer in an inner wrapper since a `@container` query
 * can't resolve against the host that declares it; reach `parts.list` to adjust it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <GridList aria-label={t("playlist.title")}>
 * 	<GridList.Item id="track-1">{t("playlist.track", { title: "Intro" })}</GridList.Item>
 * 	<GridList.Item id="track-2">{t("playlist.track", { title: "Chorus" })}</GridList.Item>
 * </GridList>
 * @example
 * <GridList aria-label={t("gallery.title")} layout="grid">
 * 	<GridList.Item id="photo-1">{t("gallery.photo", { name: "Sunset" })}</GridList.Item>
 * 	<GridList.Item id="photo-2">{t("gallery.photo", { name: "Harbor" })}</GridList.Item>
 * </GridList>
 */
export function GridList(handle: Handle<GridList.Props>) {
	return () => {
		let { layout, children, parts, mix, ...rest } = handle.props;
		let resolvedLayout = layout ?? DEFAULT_LAYOUT;

		warnIfNoAccessibleLabel(
			handle.props,
			'GridList: needs an "aria-label" or "aria-labelledby" describing its contents for assistive technology.',
		);

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					panelChrome(),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					pb(2),
					pi(2),
					outline("none"),
					container(CONTAINER_NAME),
					mix,
				]}
			>
				<div
					data-slot="list"
					data-layout={resolvedLayout}
					mix={[
						flex(),
						flexCol(),
						gap(1),
						virtualize("auto var(--ui-grid-list-intrinsic-size, 32rem)"),
						data("layout", "grid", [
							grid(),
							gap("0.5rem"),
							gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" }),
							at("40rem", CONTAINER_NAME, gridTemplate({ columns: "repeat(3, minmax(0, 1fr))" })),
							at("48rem", CONTAINER_NAME, gridTemplate({ columns: "repeat(4, minmax(0, 1fr))" })),
						]),
						parts?.list,
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * Renders a single row: a `<div>` carrying `role="row"`, its `id` mirrored
 * onto a `data-rmx-key` attribute so a paired selection, keyboard-navigation, or
 * reorder behavior can correlate the row with its own state.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <GridList.Item id="track-1">{t("playlist.track", { title: "Intro" })}</GridList.Item>
 * @example
 * <GridList.Item id="track-2" aria-selected="true">
 * 	{t("playlist.track", { title: "Chorus" })}
 * </GridList.Item>
 */
GridList.Item = function GridListItem(handle: Handle<GridList.ItemProps>) {
	return () => {
		let { id, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				id={id}
				data-rmx-key={id}
				mix={[
					interactiveTransition(),
					attrs({ role: DEFAULT_ITEM_ROLE, tabIndex: DEFAULT_ITEM_TAB_INDEX }),
					flex(),
					items("center"),
					gap(2),
					rounded("md"),
					pb(2),
					pi(2),
					fg("neutral.emphasis"),
					hover(bg("neutral.bg-tint-hover")),
					active(bg("neutral.bg-tint-pressed")),
					when("&:focus", bg("neutral.bg-tint-hover")),
					when('&[aria-selected="true"]', bg("brand.tint")),
					when('&[aria-disabled="true"]', opacity(50)),
					cursor("default"),
					outline("none"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a titled group of rows: a `<div>` carrying `role="rowgroup"`,
 * stacking an optional {@link GridList.Header} above its {@link GridList.Item}
 * rows, with a block-start rule before every section but the first.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the section's markup.
 * @example
 * <GridList.Section aria-labelledby="recents-heading">
 * 	<GridList.Header id="recents-heading">{t("playlist.recents")}</GridList.Header>
 * 	<GridList.Item id="track-1">{t("playlist.track", { title: "Intro" })}</GridList.Item>
 * </GridList.Section>
 */
GridList.Section = function GridListSection(handle: Handle<GridList.SectionProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_SECTION_ROLE }),
					flex(),
					flexCol(),
					gap(1),
					not(":first-child", [
						mbs(2),
						pbs(2),
						borderEdge("block-start", { color: "neutral", width: 1 }),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a section's label: a `<header>` styled as small, muted, uppercase
 * text for the {@link GridList.Item} rows nested beneath it in a
 * {@link GridList.Section}; point the section's `aria-labelledby` at its `id`.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the label's markup.
 * @example
 * <GridList.Header id="recents-heading">{t("playlist.recents")}</GridList.Header>
 */
GridList.Header = function GridListHeader(handle: Handle<GridList.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<header
				{...rest}
				mix={[
					pb(1),
					pi(2),
					weight("semibold"),
					tracking("wider"),
					fg("neutral.muted"),
					text("xs"),
					textTransform("uppercase"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a decorative sentinel row: a `<div>` styled as centered, muted
 * small text sized to match {@link GridList.Item}'s vertical rhythm, ready to
 * hold whatever loading indicator a paired enhancement supplies as `children`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the sentinel row's markup.
 * @example
 * <GridList.LoadMoreItem>{t("playlist.loadingMore")}</GridList.LoadMoreItem>
 */
GridList.LoadMoreItem = SentinelRow;

/**
 * Renders the drag-grab element of a row: a native `<button type="button">`
 * written before the consumer's own attributes, so a `command`/`commandfor`
 * pair still runs inside a `<form>` — a `type` seen only after them is ignored.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the handle's markup.
 * @example
 * <GridList.Item id="track-1">
 * 	{t("playlist.track", { title: "Intro" })}
 * 	<GridList.DragHandle aria-label={t("playlist.reorder")} />
 * </GridList.Item>
 */
GridList.DragHandle = function GridListDragHandle(handle: Handle<GridList.DragHandleProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<button
				type="button"
				{...rest}
				mix={[
					attrs({ role: DEFAULT_DRAG_HANDLE_ROLE, "data-drag-handle": DEFAULT_DRAG_HANDLE_MARKER }),
					fg("neutral.muted"),
					cursor("grab"),
					active(cursor("grabbing")),
					mix,
				]}
			>
				<GripVerticalIcon size={16} />
			</button>
		);
	};
};
