/**
 * Pill tabs (icon + label) that reveal one media panel at a time. Selection is
 * a radio group styled with CSS, so the stage works with JavaScript disabled.
 * Labels, icons, and panel content stay on the page as props/children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import {
	basis,
	center,
	flex,
	flexWrap,
	gap,
	hidden,
	inlineFlex,
	items,
	justify,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { p } from "@sdxc/u/size";
import { precededBy, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

/**
 * Prop types for {@link TabbedStage} and its compound parts.
 */
export namespace TabbedStage {
	/**
	 * Value {@link TabbedStage} provides so nested items share one radio name.
	 */
	export interface Context {
		/** Radio `name` every item in this stage writes. */
		name: string;
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
		 * Marks this item as the initially selected one. Only one item in a
		 * stage should pass `defaultChecked`.
		 */
		defaultChecked?: boolean;
		/** Media or staged UI revealed when this tab is selected. */
		children: RemixNode;
	}
}

/**
 * Host for pill tabs and their panels. Nest {@link TabbedStage.Item} children;
 * each item pairs a tab with the media it reveals.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing
 * {@link TabbedStage.Context}.
 * @returns The render function producing the stage's markup.
 * @example
 * <TabbedStage name="demo" aria-label={t("stage.label")}>
 * 	<TabbedStage.Item value="inbox" label={t("stage.inbox")} icon={inboxIcon} defaultChecked>
 * 		{inboxShot}
 * 	</TabbedStage.Item>
 * 	<TabbedStage.Item value="board" label={t("stage.board")} icon={boardIcon}>
 * 		{boardShot}
 * 	</TabbedStage.Item>
 * </TabbedStage>
 */
export function TabbedStage(handle: Handle<TabbedStage.Props, TabbedStage.Context>) {
	return () => {
		let { mix, name, ...rest } = handle.props;

		handle.context.set({ name });

		return (
			<div
				{...rest}
				data-slot="tabbed-stage"
				data-name={name}
				mix={[flex(), flexWrap("wrap"), justify("center"), gap(2, 6), mix]}
			/>
		);
	};
}

/**
 * One tab + panel pair. The pill label sits in the tab row; the panel spans
 * the full stage width and reveals when its adjacent radio is checked.
 *
 * @param handle Runtime handle carrying the item's props.
 * @returns The render function producing the item's markup.
 */
TabbedStage.Item = function TabbedStageItem(handle: Handle<TabbedStage.ItemProps>) {
	return () => {
		let { children, defaultChecked, icon, label, mix, value, ...rest } = handle.props;
		let context = handle.context.get(TabbedStage) as TabbedStage.Context | undefined;
		let groupName = context?.name ?? "tabbed-stage";
		let inputId = `${groupName}-tab-${value}`;

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
				<label
					htmlFor={inputId}
					mix={[
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
						bg("neutral.tint"),
						border({ color: "neutral", width: 1, style: "solid" }),
						cursor("pointer"),
						transition("color, background-color, border-color"),
						precededBy("input:checked", [
							bg("brand.solid"),
							fg("brand.onSolid"),
							border({ color: "brand", width: 1, style: "solid" }),
						]),
						precededBy("input:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					]}
				>
					{icon ? <span mix={[inlineFlex(), center()]}>{icon}</span> : null}
					{label}
				</label>
				<div
					data-slot="tabbed-stage-panel"
					mix={[
						basis("100%"),
						hidden(),
						overflow("hidden"),
						rounded("xl"),
						when(":is(input:checked) + label + &", raw({ display: "block" })),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
};
