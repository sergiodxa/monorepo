/**
 * A landmark grouping a run of independently toggled checkbox controls into
 * one related set: a `role="group"` host laying its children out in a
 * column by default, switching to a row when `orientation` is
 * `"horizontal"`. Each nested checkbox keeps its own checked state, its own
 * `name`, and its own `value` — this host contributes only the shared
 * accessible grouping, the layout, and an invalid-state color for any plain
 * text composed alongside the checkboxes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { attrs, css } from "remix/ui";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/**
 * `role="group"` applied through {@link attrs} unless a consumer supplies
 * its own `role`, announcing the host as a related set of controls to
 * assistive technology.
 */
const DEFAULT_ROLE = "group";

/**
 * Default {@link CheckboxGroup.Props} orientation, applied when
 * `orientation` is omitted, laying options out in a single column.
 */
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
	 * Props accepted by {@link CheckboxGroup}. Every native `<div>` attribute
	 * is available unchanged, so `aria-label`, `aria-labelledby`,
	 * `aria-describedby`, and `aria-invalid` all work exactly as they would on
	 * a bare grouping `<div>`, and `mix` styles that same host.
	 */
	export interface Props extends TagProps<"div"> {
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
	}
}

/**
 * Renders a `role="group"` `<div>` laying a run of independently toggled
 * checkbox children out in a column, switching to a row when `orientation`
 * is `"horizontal"`. Every checkbox nested inside keeps tracking its own
 * checked state and carries its own `name`/`value` entirely on its own —
 * there is no shared selection state anywhere in this module, only shared
 * layout and grouping semantics.
 *
 * Setting `aria-invalid="true"` on the host — directly, or mirrored in by a
 * validation script — recolors any plain text composed alongside the
 * checkboxes (a caption, a validation message) in the semantic danger tone,
 * leaving each checkbox's own coloring untouched.
 *
 * In dev mode, a group with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name to announce for the set.
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
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",

						'&[data-orientation="horizontal"]': {
							flexDirection: "row",
							gap: "1rem",
						},
						'&[aria-invalid="true"]': {
							color: "var(--ui-danger-fg)",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
