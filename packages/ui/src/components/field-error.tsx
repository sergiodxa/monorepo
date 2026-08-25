/**
 * A native form field's validation message, styled at a small size in the
 * danger foreground color. Its host carries a stable id — its own
 * `handle.id` unless a consumer supplies one — ready for a field's control
 * to reference through `aria-describedby`, and a `data-field-error` marker
 * that lets a validation script locate this slot through that same
 * `aria-describedby` list regardless of where it sits in the DOM. It
 * is the foundational error slot every field wrapper composes alongside a
 * label and a control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { text, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

/**
 * `data-field-error` applied through {@link attrs} unless a consumer
 * overrides it, marking the host as a field's error slot so a validation
 * script can locate it via the field's `aria-describedby` list.
 */
const DEFAULT_FIELD_ERROR_ATTRIBUTE = true;

/**
 * Prop types for {@link FieldError}.
 */
export namespace FieldError {
	/**
	 * Every native `<span>` attribute plus the `mix` passthrough. `children`
	 * holds the validation message the consumer supplies, and `id` defaults
	 * to this component's own `handle.id` when omitted.
	 */
	export interface Props extends TagProps<"span"> {}
}

/**
 * Renders a field's validation message. `id` falls back to `handle.id` so
 * a sibling `aria-describedby` can target it via `data-field-error`; pass
 * `hidden` to keep it out of layout until the field is invalid.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the error message's markup.
 * @example
 * <input id="email" type="email" required aria-describedby="email-error" />
 * <FieldError id="email-error">{t("fields.email.required")}</FieldError>
 * @example
 * <input type="email" required aria-describedby={handle.id} />
 * <FieldError hidden={!errors.email}>{errors.email}</FieldError>
 */
export function FieldError(handle: Handle<FieldError.Props>) {
	return () => {
		let { id, mix, ...rest } = handle.props;

		return (
			<span
				id={id ?? handle.id}
				{...rest}
				mix={[
					attrs({ "data-field-error": DEFAULT_FIELD_ERROR_ATTRIBUTE }),
					fg("danger"),
					weight("medium"),
					text("sm"),
					mix,
				]}
			/>
		);
	};
}
