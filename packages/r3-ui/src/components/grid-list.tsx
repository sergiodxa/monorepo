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
import { attrs, css } from "remix/ui";

import { focusRingPrimary } from "../styles/focus-ring";
import { interactiveTransition } from "../styles/interactive-transition";
import { panelChrome } from "../styles/panel-chrome";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { SentinelRow } from "./sentinel-row";

/**
 * Named container {@link GridList} declares on its own host, so its inner
 * row-list wrapper can react to the list's own width — switching a `"grid"`
 * layout's column count, in particular — instead of reading the viewport.
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
 * before a keyboard-navigation behavior collapses the list down to a single
 * roving stop.
 */
const DEFAULT_ITEM_TAB_INDEX = 0;

/** `role="rowgroup"` applied to {@link GridList.Section} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_SECTION_ROLE = "rowgroup";

/** `role="gridcell"` applied to {@link GridList.DragHandle} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_DRAG_HANDLE_ROLE = "gridcell";

/**
 * Marker {@link GridList.DragHandle} always carries as its `data-drag-handle`
 * attribute, applied through {@link attrs} unless a consumer supplies its
 * own value. A pointer-driven reorder behavior reads this attribute to know
 * where a drag gesture may originate within the row, rather than starting
 * one from anywhere on it.
 */
const DEFAULT_DRAG_HANDLE_MARKER = true;

/**
 * Prop types for {@link GridList} and its compound parts.
 */
export namespace GridList {
	/**
	 * Arrangement of {@link GridList.Item} rows: `"stack"` renders them as a
	 * single column, `"grid"` wraps them into a multi-column layout that grows
	 * from two columns up to four as the list's own `ui-grid-list` container
	 * widens.
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
		 * element's own `id` and a `data-key` attribute. Required even for a
		 * list with no paired behavior yet, so the row is already
		 * correlation-ready once one is attached.
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
	 * attribute except `type` (fixed to `"button"` so it never submits an
	 * enclosing form) and `children` (fixed to the handle's own grip glyph),
	 * plus a required `aria-label` since the control is icon-only.
	 */
	export interface DragHandleProps extends Omit<TagProps<"button">, "type" | "children"> {
		/** Accessible name for the icon-only control, e.g. "Reorder" or "Drag to reorder". */
		"aria-label": string;
	}
}

/**
 * Renders the list's root host: a bordered, rounded `<div>` carrying
 * `role="grid"`, wrapping an internal row-list layer that arranges
 * {@link GridList.Item} rows as either a single `"stack"`ed column or a
 * multi-column `"grid"`, and virtualizes a long list through
 * `content-visibility: auto` so its off-screen rows skip layout and paint
 * work until they scroll into view. The `"grid"` layout renders two columns
 * by default, growing to three once the list's own `ui-grid-list` container
 * passes `40rem` and to four past `48rem` — measured against the list's own
 * width rather than the viewport, so it adapts correctly however narrow or
 * wide a space it's embedded in.
 *
 * The row-list layer lives in its own internal wrapper rather than directly
 * on this root host because a `@container` query can never resolve against
 * the very element that declares the container; reach `parts.list` when the
 * wrapper's own spacing or column thresholds need adjusting.
 *
 * In dev mode, a list rendered without an `aria-label` or `aria-labelledby`
 * logs a `console.warn`, since assistive technology otherwise has no
 * accessible name to announce for it.
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
					focusRingPrimary(),
					css({
						paddingBlock: "0.5rem",
						paddingInline: "0.5rem",
						outline: "none",
						container: `${CONTAINER_NAME} / inline-size`,
					}),
					mix,
				]}
			>
				<div
					data-slot="list"
					data-layout={resolvedLayout}
					mix={[
						css({
							display: "flex",
							flexDirection: "column",
							gap: "0.25rem",
							contentVisibility: "auto",
							containIntrinsicSize: "auto var(--ui-grid-list-intrinsic-size, 32rem)",

							'&[data-layout="grid"]': {
								display: "grid",
								gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
								gap: "0.5rem",

								[`@container ${CONTAINER_NAME} (min-width: 40rem)`]: {
									gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
								},
								[`@container ${CONTAINER_NAME} (min-width: 48rem)`]: {
									gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
								},
							},
						}),
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
 * onto a `data-key` attribute so a paired selection, keyboard-navigation, or
 * reorder behavior can correlate the row with its own tracked state without
 * parsing the row's rendered content. Reachable in ordinary Tab order by
 * default — a keyboard-navigation behavior later collapses every row down to
 * a single roving stop instead. Tints on hover and swaps in a stronger tint
 * while focused; set `aria-selected="true"` directly to read it as selected
 * and `aria-disabled="true"` to mute it.
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
				data-key={id}
				mix={[
					interactiveTransition(),
					attrs({ role: DEFAULT_ITEM_ROLE, tabIndex: DEFAULT_ITEM_TAB_INDEX }),
					css({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						cursor: "default",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						paddingBlock: "0.5rem",
						paddingInline: "0.5rem",
						outline: "none",
						color: "var(--ui-neutral-fg-emphasis)",

						"&:hover": {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						},
						"&:active": {
							backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						},
						"&:focus": {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						},
						'&[aria-selected="true"]': {
							backgroundColor: "var(--ui-primary-bg-tint)",
						},
						'&[aria-disabled="true"]': {
							opacity: "0.5",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a titled group of rows: a `<div>` carrying `role="rowgroup"`,
 * stacking an optional {@link GridList.Header} label above its
 * {@link GridList.Item} rows and separating itself from a preceding sibling
 * section with a block-start rule. The list's first section renders flush,
 * with no rule or extra spacing above it.
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
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.25rem",

						"&:not(:first-child)": {
							marginBlockStart: "0.5rem",
							borderBlockStartWidth: "1px",
							borderBlockStartStyle: "solid",
							borderBlockStartColor: "var(--ui-neutral-border)",
							paddingBlockStart: "0.5rem",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a section's label: a `<header>` styled as small, muted, uppercase
 * text introducing the {@link GridList.Item} rows nested beneath it inside a
 * {@link GridList.Section}. Give it an `id` and point the enclosing
 * section's `aria-labelledby` at it to expose the label to assistive
 * technology.
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
					css({
						paddingBlock: "0.25rem",
						paddingInline: "0.5rem",
						fontSize: "0.75rem",
						lineHeight: "1rem",
						fontWeight: 600,
						textTransform: "uppercase",
						letterSpacing: "0.05em",
						color: "var(--ui-neutral-fg-muted)",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a decorative sentinel row: a `<div>` styled as centered, muted
 * small text, sized to match {@link GridList.Item}'s own vertical rhythm.
 * Carries no loading or fetching behavior of its own — it's styling only,
 * ready to hold whatever loading indicator a paired enhancement supplies as
 * `children`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the sentinel row's markup.
 * @example
 * <GridList.LoadMoreItem>{t("playlist.loadingMore")}</GridList.LoadMoreItem>
 */
GridList.LoadMoreItem = SentinelRow;

/**
 * Renders the one element inside a row a pointer-driven reorder behavior may
 * grab: a native `<button type="button">` carrying `role="gridcell"` and a
 * fixed grip glyph, styled with a grab cursor that swaps to a grabbing
 * cursor while pressed. Carries no reorder behavior of its own — a paired
 * behavior reads the button's `data-drag-handle` marker to know where a drag
 * gesture may originate within the row.
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
				{...rest}
				type="button"
				mix={[
					attrs({ role: DEFAULT_DRAG_HANDLE_ROLE, "data-drag-handle": DEFAULT_DRAG_HANDLE_MARKER }),
					css({
						cursor: "grab",
						color: "var(--ui-neutral-fg-muted)",

						"&:active": {
							cursor: "grabbing",
						},
					}),
					mix,
				]}
			>
				<GripVerticalIcon aria-hidden size={16} />
			</button>
		);
	};
};
