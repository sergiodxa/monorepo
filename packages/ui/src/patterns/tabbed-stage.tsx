/**
 * Tabs that reveal one media panel at a time, as a row of pills over the stage or as a
 * rail of steps beside a sticky stage. Selection is a radio group styled with CSS, and every
 * panel shares one stage cell, so the stage keeps its height on every tab without JavaScript.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { combine, cursor, pseudoContent, raw } from "@sdxc/u/general";
import {
	absolute,
	center,
	container,
	flex,
	flexWrap,
	gap,
	inlineFlex,
	items,
	justify,
	relative,
} from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { p } from "@sdxc/u/size";
import { before, precededBy, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import { marketingEmphasis } from "../styles/marketing.js";

/** Layout {@link TabbedStage} applies when `orientation` is omitted. */
const DEFAULT_ORIENTATION: TabbedStage.Orientation = "horizontal";

/** Container a vertical stage queries to move its panels beside the rail. */
const STAGE_CONTAINER = "ui-tabbed-stage";

/** Translucent line the vertical rail draws. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Fill of the selected pill and of an idle rail marker. */
const SURFACE_RAISED = "var(--ui-surface-raised, Canvas)";

/** Space between neighbouring pills; panels pull back by it to share one flex line. */
const PILL_GAP = "calc(var(--ui-spacing, 0.25rem) * 6)";

/** Space between the pill row and the stage. */
const PILL_ROW_GAP = "calc(var(--ui-spacing, 0.25rem) * 2)";

/** Space between the rail and an item's copy. */
const RAIL_INSET = "1.5rem";

/** Block padding around each rail item. */
const RAIL_ITEM_PADDING = "0.75rem";

/**
 * Distance from the label's top edge to its 6px marker, centring the marker on the
 * title's 28px first line.
 */
const RAIL_MARKER_OFFSET = `calc(${RAIL_ITEM_PADDING} + 0.875rem - 3px)`;

/**
 * Prop types for {@link TabbedStage} and its compound parts.
 */
export namespace TabbedStage {
	/**
	 * `horizontal` lays pill tabs over a full-width stage; `vertical` lays a rail of
	 * items beside a sticky stage from the `lg` container up, and stacks them below.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Value {@link TabbedStage} provides so nested items share one radio name and layout.
	 */
	export interface Context {
		/** Radio `name` every item in this stage writes. */
		name: string;
		/** Layout every item draws its tab and panel for. */
		orientation: Orientation;
	}

	/**
	 * Props accepted by {@link TabbedStage}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Shared `name` for the radio group that switches panels. Required so
		 * multiple stages on one page stay independent.
		 */
		name: string;
		/** Accessible name for the stage. Required — the library ships no copy. */
		"aria-label": string;
		/** Tab layout. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
		/** One or more {@link TabbedStage.Item} entries. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link TabbedStage.Item}.
	 */
	export interface ItemProps extends TagProps<"div"> {
		/** Radio value written for this tab/panel pair. */
		value: string;
		/** Visible tab label. */
		label: RemixNode;
		/** Optional glyph shown before the label. */
		icon?: RemixNode;
		/**
		 * Supporting copy under the label, shown while the item is selected in a
		 * vertical stage. A horizontal stage leaves it out.
		 */
		description?: RemixNode;
		/**
		 * Marks this item as the initially selected one. Only one item in a
		 * stage should pass `defaultChecked`.
		 */
		defaultChecked?: boolean;
		/** Media or staged UI revealed when this tab is selected. */
		children: RemixNode;
	}
}

/**
 * Counts the elements among a stage's children, flattening mapped arrays, so a vertical
 * stage gives each rail item its own grid row. Text, booleans and nullish slots draw no item.
 *
 * @param children The stage's `children` value.
 * @returns How many items the stage holds.
 */
function countItems(children: unknown): number {
	if (Array.isArray(children)) {
		return children.reduce<number>((total, child) => total + countItems(child), 0);
	}
	return typeof children === "object" && children !== null ? 1 : 0;
}

/**
 * Host for tabs and their panels. Nest {@link TabbedStage.Item} children; each item
 * pairs a tab with the media it reveals. A vertical stage wraps itself in a named
 * container so the rail and stage sit side by side where there is room, and stack below.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing
 * {@link TabbedStage.Context}.
 * @returns The render function producing the stage's markup.
 * @example
 * <TabbedStage name="demo" aria-label={t("stage.label")}>
 * 	<TabbedStage.Item value="inbox" label={t("stage.inbox")} icon={inboxIcon} defaultChecked>
 * 		{inboxShot}
 * 	</TabbedStage.Item>
 * </TabbedStage>
 * @example
 * <TabbedStage name="how" orientation="vertical" aria-label={t("how.label")}>
 * 	<TabbedStage.Item value="detect" label={t("how.detect")} description={t("how.detect.body")} defaultChecked>
 * 		{detectShot}
 * 	</TabbedStage.Item>
 * </TabbedStage>
 */
export function TabbedStage(handle: Handle<TabbedStage.Props, TabbedStage.Context>) {
	return () => {
		let { children, mix, name, orientation, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;

		handle.context.set({ name, orientation: resolvedOrientation });

		if (resolvedOrientation === "horizontal") {
			return (
				<div
					role="group"
					{...rest}
					data-slot="tabbed-stage"
					data-name={name}
					data-orientation={resolvedOrientation}
					mix={[
						flex(),
						flexWrap("wrap"),
						justify("center"),
						raw({ rowGap: PILL_ROW_GAP, columnGap: PILL_GAP }),
						mix,
					]}
				>
					{children}
				</div>
			);
		}

		let rows = Math.max(countItems(children), 1);

		return (
			<div mix={[container(STAGE_CONTAINER)]}>
				<div
					role="group"
					{...rest}
					data-slot="tabbed-stage"
					data-name={name}
					data-orientation={resolvedOrientation}
					mix={[
						combine([
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr)",
								gridTemplateRows: `repeat(${rows}, min-content) auto`,
							}),
							at(
								"lg",
								STAGE_CONTAINER,
								raw({
									display: "grid",
									gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)",
									gridTemplateRows: `repeat(${rows}, min-content) 1fr`,
									columnGap: "clamp(2rem, 6cqi, 4rem)",
									alignItems: "start",
								}),
							),
						]),
						mix,
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * Pill tab for a horizontal stage: quiet ink on a transparent fill, lifted onto the
 * raised surface with the control edge while selected. One class carries every state,
 * so the selected fill always outranks the hover fill.
 */
function pillTab() {
	return combine([
		raw({ order: -1 }),
		inlineFlex(),
		items("center"),
		justify("center"),
		gap(2),
		p(2, 3.5),
		rounded("full"),
		text("sm"),
		weight("medium"),
		fg("neutral"),
		raw({ backgroundColor: "transparent", border: "1px solid transparent" }),
		cursor("pointer"),
		transition("color, background-color, box-shadow"),
		when("&:hover", bg("neutral.bg-tint-hover")),
		precededBy(
			"input:checked",
			raw({
				backgroundColor: SURFACE_RAISED,
				boxShadow: "var(--ui-shadow-control, 0 0 0 1px rgb(0 0 0 / 0.08))",
				color: "var(--ui-neutral-fg-emphasis)",
			}),
		),
		precededBy("input:focus-visible", outline({ color: "brand.ring", offset: 2 })),
	]);
}

/**
 * Rail item for a vertical stage: a hairline along the inline-start edge with a 6px square
 * marker that fills with the brand while selected. The focus ring sits inside the item so
 * the rail beside it stays visible.
 */
function railTab() {
	return combine([
		relative(),
		raw({
			display: "block",
			gridColumn: "1",
			paddingBlock: RAIL_ITEM_PADDING,
			paddingInlineStart: RAIL_INSET,
			paddingInlineEnd: "0.75rem",
			borderInlineStart: `1px solid ${HAIRLINE}`,
		}),
		fg("neutral"),
		cursor("pointer"),
		transition("color"),
		when("&:hover", fg("neutral.emphasis")),
		before([
			pseudoContent('""'),
			absolute(),
			raw({
				insetInlineStart: "-3.5px",
				insetBlockStart: RAIL_MARKER_OFFSET,
				inlineSize: "6px",
				blockSize: "6px",
				backgroundColor: SURFACE_RAISED,
				boxShadow: "0 0 0 1px var(--ui-neutral-border)",
			}),
		]),
		precededBy("input:checked", [
			fg("neutral.emphasis"),
			before(raw({ backgroundColor: "var(--ui-brand-bg-solid)", boxShadow: "none" })),
		]),
		precededBy("input:focus-visible", outline({ color: "brand.ring", offset: -2 })),
	]);
}

/**
 * Panel for a horizontal stage. Each panel after the first pulls back over the first by its
 * width plus the pill gap, so every panel shares the line under the pills and the stage takes
 * the tallest one's height; unselected panels stay hidden from sight, focus and the a11y tree.
 */
function pillPanel() {
	return combine([
		raw({ flex: "0 0 100%", overflow: "hidden", visibility: "hidden" }),
		rounded("xl"),
		when(
			'[data-slot="tabbed-stage-item"] ~ [data-slot="tabbed-stage-item"] > &',
			raw({ marginInlineStart: `calc(-100% - ${PILL_GAP})` }),
		),
		precededBy("input:checked", raw({ visibility: "visible" })),
	]);
}

/**
 * Panel for a vertical stage. Every panel shares one grid cell sized to the tallest: under the
 * rail below `lg`, and from `lg` up in the stage column, sticky under the marketing header.
 * Unselected panels stay hidden from sight, focus and assistive technology.
 */
function railPanel() {
	return combine([
		raw({
			gridColumn: "1",
			gridRow: "-2 / -1",
			visibility: "hidden",
			paddingBlockStart: "1.5rem",
		}),
		precededBy("input:checked", raw({ visibility: "visible" })),
		at(
			"lg",
			STAGE_CONTAINER,
			raw({
				gridColumn: "2",
				gridRow: "1 / -1",
				alignSelf: "start",
				position: "sticky",
				insetBlockStart: "calc(var(--ui-marketing-header-height, 4rem) + 2rem)",
				paddingBlockStart: "0",
			}),
		),
	]);
}

/**
 * One tab + panel pair. In a horizontal stage the pill sits in the tab row and the panel
 * spans the stage; in a vertical stage the item joins the rail and its panel takes the
 * stage column. The panel reveals while the item's radio is checked.
 *
 * @param handle Runtime handle carrying the item's props.
 * @returns The render function producing the item's markup.
 */
TabbedStage.Item = function TabbedStageItem(handle: Handle<TabbedStage.ItemProps>) {
	return () => {
		let { children, defaultChecked, description, icon, label, mix, value, ...rest } = handle.props;
		let context = handle.context.get(TabbedStage) as TabbedStage.Context | undefined;
		let groupName = context?.name ?? "tabbed-stage";
		let isVertical = context?.orientation === "vertical";
		let inputId = `${groupName}-tab-${value}`;
		let glyph = icon ? <span mix={[inlineFlex(), center()]}>{icon}</span> : null;

		return (
			<div
				{...rest}
				data-slot="tabbed-stage-item"
				data-value={value}
				mix={[raw({ display: "contents" }), mix]}
			>
				<input
					type="radio"
					name={groupName}
					id={inputId}
					value={value}
					defaultChecked={defaultChecked}
					mix={[visuallyHidden()]}
				/>
				{isVertical ? (
					<label htmlFor={inputId} data-slot="tabbed-stage-tab" mix={[railTab()]}>
						<span mix={[inlineFlex(), items("center"), gap(2), text("lg"), weight("medium")]}>
							{glyph}
							{label}
						</span>
						{description ? (
							<span
								data-slot="tabbed-stage-description"
								mix={[
									combine([
										raw({ display: "none", marginBlockStart: "0.25rem" }),
										text("sm"),
										raw({ lineHeight: "1.625" }),
										fg("neutral"),
										when(":is(input:checked) ~ label &", raw({ display: "block" })),
									]),
									marketingEmphasis(),
								]}
							>
								{description}
							</span>
						) : null}
					</label>
				) : (
					<label htmlFor={inputId} data-slot="tabbed-stage-tab" mix={[pillTab()]}>
						{glyph}
						{label}
					</label>
				)}
				<div data-slot="tabbed-stage-panel" mix={[isVertical ? railPanel() : pillPanel()]}>
					{children}
				</div>
			</div>
		);
	};
};
