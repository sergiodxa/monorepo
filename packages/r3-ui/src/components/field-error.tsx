/**
 * A native form field's validation message, styled at a small size in the
 * danger foreground color. Its host carries a stable id — its own
 * `handle.id` unless a consumer supplies one — ready for a field's control
 * to reference through `aria-describedby`, and a `data-field-error` marker
 * that lets a validation script locate this slot through that same
 * `aria-describedby` list without assuming a fixed position in the DOM. It
 * is the foundational error slot every field wrapper composes alongside a
 * label and a control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { attrs, css } from "remix/ui";

/**
 * `data-field-error` applied through {@link attrs} unless a consumer
 * overrides it. Marks the host as a field's error slot so a validation
 * script can find it through the field's `aria-describedby` list instead of
 * assuming where in the DOM it sits relative to the field.
 */
const DEFAULT_FIELD_ERROR_ATTRIBUTE = true;

/**
 * Prop types for {@link FieldError}.
 */
export namespace FieldError {
	/**
	 * Every native `<span>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` is the validation message itself — supplied by the consumer,
	 * whether written by hand, filled in from a server-parsed schema result,
	 * or mirrored in by a validation script — and `id` defaults to this
	 * component's own `handle.id` when omitted.
	 */
	export interface Props extends TagProps<"span"> {}
}

/**
 * Renders a field's validation message in a `<span>` sized and colored as
 * small, medium-weight danger copy. The host's `id` falls back to this
 * component's own `handle.id` when the consumer doesn't supply one, so a
 * sibling control can point its `aria-describedby` at that same value, and
 * `data-field-error` stays on the host so a validation script can find this
 * slot through that same `aria-describedby` list.
 *
 * Visibility follows the platform's own baseline: pass the native `hidden`
 * attribute to keep the message out of the layout until the field the
 * message describes is actually invalid, whether that decision comes from a
 * server-rendered validation result or a script mirroring the field's own
 * validity state.
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
					css({
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						fontWeight: "500",
						color: "var(--ui-danger-fg)",
					}),
					mix,
				]}
			/>
		);
	};
}
