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

import { fg } from "@pkg/u/color";
import { visibility } from "@pkg/u/effects";
import { bs, is } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { attrs } from "remix/ui";

/**
 * `aria-hidden="true"` applied through {@link attrs} unless a consumer
 * overrides it. The indicator only restates a selection state its host
 * already exposes through `aria-selected`/`aria-current`, so assistive
 * technology gains nothing from encountering the marker itself.
 */
const DEFAULT_ARIA_HIDDEN = true;

/**
 * Prop types for {@link SelectionIndicator}.
 */
export namespace SelectionIndicator {
	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough. Selection
	 * state rides the same native attributes a selectable row or tab already
	 * carries: set `aria-selected="true"` for a menu, listbox, or tab option,
	 * or a truthy `aria-current` for a nav-style current-item marker, directly
	 * on this host. There is no separate boolean prop for it, since the
	 * attribute doubles as both the styling hook and the value a consumer was
	 * already going to set.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Renders a fixed-size marker that is present in the layout at all times but
 * only becomes visible once its own host carries `aria-selected="true"` or a
 * truthy `aria-current` — `visibility` toggles rather than `display`, so the
 * marker's footprint stays reserved and sibling content never shifts when
 * selection changes. Sizes itself from `--ui-selection-indicator-size`
 * (defaulting to a compact square that fits a menu or listbox item's leading
 * checkmark slot) and colors from `currentColor`, inheriting whatever text
 * color the surrounding row sets. A consumer building a sliding tab-strip
 * underline instead repositions and reshapes it through the `mix`
 * passthrough — this component's own styling covers only sizing, color, and
 * the selected/unselected visibility switch.
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
