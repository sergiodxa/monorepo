/**
 * A small marker that stays invisible, while still reserving its own layout
 * slot, until the element carrying it is the current selection. Anchors a
 * menu or listbox option's checkmark, a tab strip's active-tab underline, or
 * any similar per-item selection cue to a fixed spot so neighboring content
 * never reflows between the selected and unselected states.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { visibility } from "@sdxc/u/effects";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { attrs } from "remix/ui";

/**
 * `aria-hidden="true"` applied through {@link attrs} unless a consumer
 * overrides it. The indicator restates a selection state already exposed
 * via `aria-selected`/`aria-current`, so assistive technology gains nothing.
 */
const DEFAULT_ARIA_HIDDEN = "true";

/**
 * Prop types for {@link SelectionIndicator}.
 */
export namespace SelectionIndicator {
	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough. Selection
	 * state reads directly from `aria-selected`/`aria-current` already set on
	 * the host, so there is no separate boolean prop to duplicate it.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Renders a marker that stays present in the layout at all times but only
 * becomes visible once its host carries `aria-selected="true"` or a truthy
 * `aria-current`, so sibling content never reflows on selection change.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the indicator's markup.
 * @example
 * <Menu.Item aria-selected={isChecked}>
 * 	<SelectionIndicator aria-selected={isChecked}>
 * 		<CheckIcon />
 * 	</SelectionIndicator>
 * 	<Text slot="label">{t("menu.autosave")}</Text>
 * </Menu.Item>
 * @example
 * <Tabs.Trigger id="billing" aria-selected={activeTab === "billing"}>
 * 	{t("settings.tabs.billing")}
 * 	<SelectionIndicator
 * 		aria-selected={activeTab === "billing"}
 * 		mix={css({ position: "absolute", insetBlockEnd: "0", insetInline: "0", blockSize: "2px" })}
 * 	/>
 * </Tabs.Trigger>
 */
export function SelectionIndicator(handle: Handle<SelectionIndicator.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN }),
					is("var(--ui-selection-indicator-size, 1rem)"),
					bs("var(--ui-selection-indicator-size, 1rem)"),
					fg("currentColor"),
					visibility("hidden"),
					when('&[aria-selected="true"]', visibility()),
					when('&[aria-current]:not([aria-current="false"])', visibility()),
					mix,
				]}
			/>
		);
	};
}
