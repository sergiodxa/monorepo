/**
 * A centred pill segmented control over a media stage, the switcher a hero puts between its
 * calls to action and the product. Selection is a native radio group, so it switches with
 * arrow keys and without JavaScript, and the stage holds the tallest panel's height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { outline } from "@sdxc/u/color";
import { transition } from "@sdxc/u/effects";
import { combine, raw } from "@sdxc/u/general";
import { noScrollbar } from "@sdxc/u/overflow";
import { when } from "@sdxc/u/state";

/** Lift under the selected tab: a contact shadow and a brand-tinted spread. */
const ACTIVE_LIFT =
	"0 1px 2px rgb(0 0 0 / 0.05), 0 3px 8px color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent)";

/** Track behind the tabs: a 4% wash of the emphasis ink, so it reads in either scheme. */
const TRACK_FILL = "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 4%, transparent)";

/**
 * Prop types for {@link SegmentedStage} and its items.
 */
export namespace SegmentedStage {
	/** Which half of the stage an item is drawing: its tab in the control, or its panel. */
	export type Part = "tab" | "panel";

	/**
	 * Value each half of the stage provides so its items share one radio name and know
	 * which half they draw.
	 */
	export interface PartContext {
		/** Radio `name` every item in this stage writes. */
		name: string;
		/** Half the items under this provider draw. */
		part: Part;
	}

	/**
	 * Props accepted by {@link SegmentedStage}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Radio group name; unique per page so several stages stay independent. */
		name: string;
		/** Accessible name for the control. Required — the library ships no copy. */
		"aria-label": string;
		/** Two or more {@link SegmentedStage.Item} entries. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link SegmentedStage.Item}.
	 */
	export interface ItemProps {
		/** Radio value for this tab and panel pair. */
		value: string;
		/** Visible tab label. */
		label: RemixNode;
		/** Marks the item selected on load. Exactly one item in a stage should pass it. */
		defaultChecked?: boolean;
		/** Media the tab reveals: a product frame, a code stage, a screenshot. */
		children: RemixNode;
	}
}

/**
 * Quotes `value` as a CSS string so any radio id can sit inside an attribute selector.
 *
 * @param value Raw identifier.
 * @returns The identifier as a double-quoted CSS string.
 */
function cssString(value: string): string {
	return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

/** Radio id shared by an item's input, tab label and panel. */
function inputIdFor(name: string, value: string): string {
	return `${name}-segment-${value}`;
}

/**
 * Renders the control and the stage from one list of items: each item draws its tab in
 * the control and its panel in the stage. Panels share one grid cell, so the stage is as
 * tall as its tallest panel and switching never moves the page below.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the control and stage.
 * @example
 * <SegmentedStage name="hero-views" aria-label={t("hero.views")}>
 * 	<SegmentedStage.Item value="board" label={t("hero.board")} defaultChecked>
 * 		<ProductFrame title="Board">{board}</ProductFrame>
 * 	</SegmentedStage.Item>
 * 	<SegmentedStage.Item value="api" label={t("hero.api")}>
 * 		<CodeStage title="request.ts">{code}</CodeStage>
 * 	</SegmentedStage.Item>
 * </SegmentedStage>
 */
export function SegmentedStage(handle: Handle<SegmentedStage.Props>) {
	return () => {
		let { "aria-label": ariaLabel, children, mix, name, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="segmented-stage"
				data-name={name}
				mix={[
					raw({ display: "flex", flexDirection: "column", gap: "1.5rem", minInlineSize: "0" }),
					mix,
				]}
			>
				<div
					data-slot="segmented-stage-scroller"
					mix={[
						raw({
							display: "flex",
							maxInlineSize: "100%",
							overflowX: "auto",
							overscrollBehaviorInline: "contain",
						}),
						noScrollbar(),
					]}
				>
					<div
						role="radiogroup"
						aria-label={ariaLabel}
						data-slot="segmented-stage-control"
						mix={[
							raw({
								display: "inline-flex",
								flex: "none",
								gap: "2px",
								marginInline: "auto",
								padding: "4px",
								borderRadius: "9999px",
								backgroundColor: TRACK_FILL,
							}),
						]}
					>
						<StagePart name={name} part="tab">
							{children}
						</StagePart>
					</div>
				</div>
				<div
					data-slot="segmented-stage-panels"
					mix={[raw({ display: "grid", minInlineSize: "0" })]}
				>
					<StagePart name={name} part="panel">
						{children}
					</StagePart>
				</div>
			</div>
		);
	};
}

/**
 * Tells the items beneath it which half of the stage they draw, so one list of items fills
 * both the control and the panels.
 *
 * @param handle Runtime handle carrying the half to draw and providing
 * {@link SegmentedStage.PartContext}.
 * @returns The render function passing the items through.
 */
function StagePart(
	handle: Handle<SegmentedStage.PartContext & { children: RemixNode }, SegmentedStage.PartContext>,
) {
	return () => {
		handle.context.set({ name: handle.props.name, part: handle.props.part });
		return <>{handle.props.children}</>;
	};
}

/**
 * Tab in the control: a 36px pill holding its visually hidden radio, so a focused radio
 * scrolls its own pill into view. The selected pill sits on the page background with a
 * brand-tinted lift; the others stay in muted ink.
 */
function tabStyles() {
	return combine([
		raw({
			position: "relative",
			display: "inline-flex",
			flex: "none",
			alignItems: "center",
			justifyContent: "center",
			blockSize: "36px",
			paddingInline: "1rem",
			borderRadius: "9999px",
			fontSize: "14px",
			lineHeight: "20px",
			fontWeight: "500",
			whiteSpace: "nowrap",
			cursor: "pointer",
			userSelect: "none",
			color: "var(--ui-neutral-fg)",
			backgroundColor: "transparent",
		}),
		transition("color, background-color, box-shadow"),
		when("&:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		when(
			"&:has(input:checked)",
			raw({
				color: "var(--ui-neutral-fg-emphasis)",
				backgroundColor: "var(--ui-surface-raised, Canvas)",
				boxShadow: ACTIVE_LIFT,
			}),
		),
		when("&:has(input:focus-visible)", outline({ color: "brand.ring", offset: -2 })),
	]);
}

/**
 * One tab and panel pair. Under the control it draws the radio pill; under the stage it
 * draws the panel, which stays laid out while hidden so the stage keeps the tallest
 * panel's height, and shows while the matching radio is checked.
 *
 * @param handle Runtime handle carrying the item's props.
 * @returns The render function producing the tab or the panel.
 */
SegmentedStage.Item = function SegmentedStageItem(handle: Handle<SegmentedStage.ItemProps>) {
	return () => {
		let { children, defaultChecked, label, value } = handle.props;
		let context = handle.context.get(StagePart) as SegmentedStage.PartContext | undefined;
		let name = context?.name ?? "segmented-stage";
		let inputId = inputIdFor(name, value);
		let labelId = `${inputId}-label`;

		if (context?.part !== "panel") {
			return (
				<label id={labelId} htmlFor={inputId} data-slot="segmented-stage-tab" mix={[tabStyles()]}>
					<input
						type="radio"
						name={name}
						id={inputId}
						value={value}
						defaultChecked={defaultChecked}
						mix={[visuallyHidden()]}
					/>
					{label}
				</label>
			);
		}

		return (
			<div
				role="group"
				aria-labelledby={labelId}
				data-slot="segmented-stage-panel"
				data-value={value}
				mix={[
					raw({ gridArea: "1 / 1", minInlineSize: "0", visibility: "hidden" }),
					when(
						`:where([data-slot="segmented-stage"]:has([id=${cssString(inputId)}]:checked)) &`,
						raw({ visibility: "visible" }),
					),
				]}
			>
				{children}
			</div>
		);
	};
};
