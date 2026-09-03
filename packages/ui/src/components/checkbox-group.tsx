/**
 * A landmark grouping independently toggled checkbox controls into one
 * related set: a `role="group"` host laying children out in a column, or a
 * row when `orientation` is `"horizontal"`. Each nested checkbox keeps its
 * own checked state, `name`, and `value`; the host contributes the shared
 * grouping, the layout, and an invalid-state color for composed text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { flexRow, gap, vstack } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { attrs } from "remix/ui";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/**
 * Announces the host as a related set of controls to assistive technology;
 * {@link attrs} lets a consumer's own `role` win.
 */
const DEFAULT_ROLE = "group";

const DEFAULT_ORIENTATION: CheckboxGroup.Orientation = "vertical";

/**
 * Prop types for {@link CheckboxGroup}.
 */
export namespace CheckboxGroup {
	/**
	 * Axis a group's checkboxes lay out along: a single column, or a single
	 * row.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Props accepted by {@link CheckboxGroup}. Native `<div>` attributes and
	 * `mix` pass through to the grouping host, so `aria-label`,
	 * `aria-labelledby`, `aria-describedby`, and `aria-invalid` behave natively.
	 */
	export interface Props extends TagProps<"div"> {
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
	}
}

/**
 * Lays checkbox children out in a column, or a row when `orientation` is
 * `"horizontal"`; each nested checkbox keeps its own checked state, `name`,
 * and `value`. `aria-invalid="true"` recolors plain text composed alongside.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <CheckboxGroup aria-labelledby="fruits-label">
 * 	<Label id="fruits-label">{t("fruits.label")}</Label>
 * 	<Checkbox name="fruits" value="apple">{t("fruits.apple")}</Checkbox>
 * 	<Checkbox name="fruits" value="banana">{t("fruits.banana")}</Checkbox>
 * 	<Checkbox name="fruits" value="orange">{t("fruits.orange")}</Checkbox>
 * </CheckboxGroup>
 * @example
 * <CheckboxGroup aria-label={t("notifications.label")} orientation="horizontal">
 * 	<Checkbox name="notify" value="email">{t("notifications.email")}</Checkbox>
 * 	<Checkbox name="notify" value="sms">{t("notifications.sms")}</Checkbox>
 * 	<Checkbox name="notify" value="push">{t("notifications.push")}</Checkbox>
 * </CheckboxGroup>
 * @example
 * <CheckboxGroup aria-labelledby="terms-label" aria-invalid="true" aria-describedby="terms-error">
 * 	<Label id="terms-label">{t("terms.label")}</Label>
 * 	<Checkbox name="terms" value="accepted" required>{t("terms.accept")}</Checkbox>
 * 	<FieldError id="terms-error">{t("terms.required")}</FieldError>
 * </CheckboxGroup>
 */
export function CheckboxGroup(handle: Handle<CheckboxGroup.Props>) {
	return () => {
		let { orientation, mix, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;

		warnIfNoAccessibleLabel(
			handle.props,
			"CheckboxGroup: a group with no `aria-label` or `aria-labelledby` needs one describing the set — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<div
				data-orientation={resolvedOrientation}
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					vstack({ gap: 2 }),
					when('&[data-orientation="horizontal"]', [flexRow(), gap(4)]),
					when('&[aria-invalid="true"]', fg("danger")),
					mix,
				]}
			/>
		);
	};
}
