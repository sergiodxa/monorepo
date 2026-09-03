/**
 * A split-pane layout arranging {@link Resizable.Panel} and
 * {@link Resizable.Handle} parts along a shared axis, each panel taking up
 * its own declared share of the group's main axis and each handle between
 * two panels reserving a fixed track across the cross axis. Every part
 * mirrors the root's orientation onto itself through component context, so a
 * panel's own minimum and maximum share and a handle's cursor and track both
 * switch axis together without a consumer repeating the orientation on each
 * one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, fg, outline, outlineStyle } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor, raw, touchAction, userSelect } from "@sdxc/u/general";
import {
	basis,
	flex,
	flexCol,
	flexRow,
	grow,
	items,
	justify,
	relative,
	shrink,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, maxBs, maxIs, minBs, minIs } from "@sdxc/u/size";
import { before, data, focusVisible, hover, when } from "@sdxc/u/state";
import { attrs } from "remix/ui";

import { mergeStyle } from "../utils/merge-style.js";

/** Default {@link Resizable.Props} orientation, applied when `orientation` is omitted. */
const DEFAULT_ORIENTATION: Resizable.Orientation = "horizontal";

/** `role="separator"` applied to {@link Resizable.Handle} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_HANDLE_ROLE = "separator";

/**
 * Default {@link Resizable.HandleProps} tab index, applied through
 * {@link attrs} unless a consumer supplies its own, keeping a handle
 * reachable in Tab order per the WAI-ARIA window splitter pattern.
 */
const DEFAULT_HANDLE_TAB_INDEX = 0;

/**
 * Prop types for {@link Resizable} and its compound parts.
 */
export namespace Resizable {
	/**
	 * Axis the panels lay out along: a row of panels side by side, or a
	 * column of panels stacked one above another.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Value {@link Resizable} stores in component context so every
	 * {@link Resizable.Panel} and {@link Resizable.Handle} nested inside reads
	 * the same axis for its own `data-orientation`, sizing, and cursor.
	 */
	export interface Context {
		/** The root's resolved layout axis. */
		orientation: Orientation;
	}

	/**
	 * Props accepted by {@link Resizable}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
	}

	/**
	 * Props accepted by {@link Resizable.Panel}.
	 */
	export interface PanelProps extends TagProps<"div"> {
		/**
		 * Starting share of the group's main axis, as a percentage (e.g. `30`
		 * for 30%). Panels left without one split whatever share remains
		 * evenly among themselves.
		 */
		defaultSize?: number;
		/**
		 * Smallest share of the group's main axis this panel will shrink to,
		 * as a percentage. Left unset, the panel can shrink down to nothing.
		 */
		minSize?: number;
		/**
		 * Largest share of the group's main axis this panel will grow to, as
		 * a percentage. Left unset, the panel can grow up to the group's
		 * entire main axis.
		 */
		maxSize?: number;
	}

	/**
	 * Props accepted by {@link Resizable.Handle}. Its accessible name comes
	 * entirely from `aria-label` or `aria-labelledby`; pair it with
	 * `aria-controls` naming the panels on either side.
	 */
	export interface HandleProps extends TagProps<"div"> {}
}

/**
 * Renders the root host: a `<div>` laying {@link Resizable.Panel} and
 * {@link Resizable.Handle} children out in a row, or a column when
 * `orientation` is `"vertical"`, sharing the resolved axis through context; set `aria-disabled="true"` to dim the whole group.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link Resizable.Context}.
 * @returns The render function producing the root's markup.
 * @example
 * <Resizable aria-label={t("layout.panes")}>
 * 	<Resizable.Panel id="sidebar" defaultSize={30} minSize={15}>
 * 		{t("layout.sidebar")}
 * 	</Resizable.Panel>
 * 	<Resizable.Handle aria-label={t("layout.resizeSidebar")} aria-controls="sidebar main" />
 * 	<Resizable.Panel id="main" defaultSize={70}>
 * 		{t("layout.main")}
 * 	</Resizable.Panel>
 * </Resizable>
 * @example
 * <Resizable orientation="vertical" aria-label={t("layout.panes")}>
 * 	<Resizable.Panel defaultSize={60}>{t("layout.top")}</Resizable.Panel>
 * 	<Resizable.Handle aria-label={t("layout.resizeVertically")} />
 * 	<Resizable.Panel defaultSize={40}>{t("layout.bottom")}</Resizable.Panel>
 * </Resizable>
 */
export function Resizable(handle: Handle<Resizable.Props, Resizable.Context>) {
	return () => {
		let { orientation, mix, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;

		handle.context.set({ orientation: resolvedOrientation });

		return (
			<div
				data-orientation={resolvedOrientation}
				{...rest}
				mix={[
					flex(),
					flexRow(),
					is("full"),
					overflow("hidden"),
					when('&[data-orientation="vertical"]', flexCol()),
					when('&[aria-disabled="true"]', opacity(70)),
					rounded("lg"),
					border({ color: "neutral", width: 1 }),
					bg("neutral.tint"),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders a single pane: a `<div>` that grows and shrinks to fill its share
 * of the group's main axis, clipping overflow with scrolling. Each of
 * `defaultSize`/`minSize`/`maxSize` lives on a `--ui-resizable-panel-*` custom property a pointer-tracking behavior can update to resize it live.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the pane's markup.
 * @example
 * <Resizable.Panel defaultSize={30} minSize={15} maxSize={50}>
 * 	{t("layout.sidebar")}
 * </Resizable.Panel>
 */
Resizable.Panel = function ResizablePanel(handle: Handle<Resizable.PanelProps>) {
	return () => {
		let { mix, style, defaultSize, minSize, maxSize, ...rest } = handle.props;
		let context = handle.context.get(Resizable);

		let resolvedStyle = mergeStyle(style, {
			"--ui-resizable-panel-size": defaultSize == null ? null : `${defaultSize}%`,
			"--ui-resizable-panel-min-size": minSize == null ? null : `${minSize}%`,
			"--ui-resizable-panel-max-size": maxSize == null ? null : `${maxSize}%`,
		});

		return (
			<div
				data-orientation={context.orientation}
				data-default-size={defaultSize}
				data-min-size={minSize}
				data-max-size={maxSize}
				{...rest}
				style={resolvedStyle}
				mix={[
					grow(),
					shrink(1),
					basis("var(--ui-resizable-panel-size, 0%)"),
					minBs(0),
					minIs(0),
					data("orientation", "horizontal", [
						minIs("var(--ui-resizable-panel-min-size, 0%)"),
						maxIs("var(--ui-resizable-panel-max-size, 100%)"),
					]),
					data("orientation", "vertical", [
						minBs("var(--ui-resizable-panel-min-size, 0%)"),
						maxBs("var(--ui-resizable-panel-max-size, 100%)"),
					]),
					overflow("auto"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a draggable divider between two adjacent panels: a
 * `role="separator"` `<div>` reachable in Tab order, its bar darkening on
 * hover and ready for `&[data-resizing]` to color it during a drag. Its accessible name comes entirely from `aria-label`/`aria-labelledby`, paired with `aria-controls` naming the panels it resizes.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the handle's markup.
 * @example
 * <Resizable.Handle aria-label={t("layout.resizeSidebar")} aria-controls="sidebar main" />
 * @example
 * <Resizable.Handle aria-label={t("layout.resizeSidebar")} aria-disabled="true" />
 */
Resizable.Handle = function ResizableHandle(handle: Handle<Resizable.HandleProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let context = handle.context.get(Resizable);

		if (import.meta.env.DEV && !rest["aria-label"] && !rest["aria-labelledby"]) {
			console.warn(
				"Resizable.Handle: a resize handle with no `aria-label` or `aria-labelledby` needs one describing what it resizes — assistive technology has no accessible name to announce otherwise.",
			);
		}

		return (
			<div
				data-orientation={context.orientation}
				aria-orientation={context.orientation}
				{...rest}
				mix={[
					attrs({ role: DEFAULT_HANDLE_ROLE, tabIndex: DEFAULT_HANDLE_TAB_INDEX }),
					relative(),
					flex(),
					grow(0),
					shrink(0),
					basis("var(--ui-resizable-handle-size, 0.75rem)"),
					items("center"),
					justify("center"),
					bg("transparent"),
					userSelect(),
					touchAction(),
					outlineStyle("none"),
					when('&[data-orientation="horizontal"]', cursor("col-resize")),
					when('&[data-orientation="vertical"]', cursor("row-resize")),
					/** `raw()` sets the bare CSS `content` property directly, its only utility path. */
					before(raw({ content: '""' })),
					data("orientation", "horizontal", before([bs("2.5rem"), is("0.125rem")])),
					data("orientation", "vertical", before([bs("0.125rem"), is("2.5rem")])),
					when('&[aria-disabled="true"]', [cursor("not-allowed"), opacity(50)]),
					fg("neutral.muted"),
					when("&::before", [rounded("full"), bg("neutral.border")]),
					hover(when("&::before", bg("neutral.strong"))),
					when("&[data-resizing]::before", bg("brand.solid")),
					focusVisible(outline({ color: "brand.ring" })),
					mix,
				]}
			/>
		);
	};
};
