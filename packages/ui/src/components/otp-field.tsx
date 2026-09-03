/**
 * A one-time-code field: a native `<input>` defaulting to a numeric virtual
 * keyboard and the platform's SMS/email autofill hint for one-time codes,
 * built on {@link Input} for its box, color, and interaction-state styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { tabularNums, text, textAlign, weight } from "@sdxc/u/typography";

import { Input } from "./input.js";

/** Maximum code length {@link OtpField} falls back to when `length` is omitted. */
const DEFAULT_LENGTH = 6;

/** Virtual-keyboard hint {@link OtpField} falls back to when `inputMode` is omitted. */
const DEFAULT_INPUT_MODE = "numeric";

/** Platform autofill hint {@link OtpField} falls back to when `autoComplete` is omitted. */
const DEFAULT_AUTO_COMPLETE = "one-time-code";

/**
 * Prop types for {@link OtpField}.
 */
export namespace OtpField {
	/**
	 * Every {@link Input} prop except `type`, `list`, `role`, `inputMode`,
	 * `autoComplete`, and `maxLength`, fixed to a plain text control with
	 * `inputMode`/`autoComplete`/`length` read from the fields below instead.
	 */
	export interface Props extends Omit<
		Input.Props,
		"type" | "list" | "role" | "inputMode" | "autoComplete" | "maxLength"
	> {
		/**
		 * The one-time code's character count, applied as the control's native
		 * `maxLength`. Defaults to {@link DEFAULT_LENGTH}.
		 */
		length?: number;
		/**
		 * Virtual-keyboard hint passed straight through to the native `inputMode`
		 * attribute. Defaults to {@link DEFAULT_INPUT_MODE}, requesting the
		 * numeric keypad; set it to `"text"` for a code that mixes in letters.
		 */
		inputMode?: Input.Props["inputMode"];
		/**
		 * Platform autofill hint passed straight through to the native
		 * `autoComplete` attribute. Defaults to {@link DEFAULT_AUTO_COMPLETE}, which
		 * a browser or OS keyboard looks for to offer an SMS or email code inline.
		 */
		autoComplete?: Input.Props["autoComplete"];
	}
}

/**
 * Renders a single native `<input>` for entering a one-time verification
 * code, built on {@link Input}, sized as one full-width control since a
 * single `<input>` is what carries `autoComplete="one-time-code"` reliably.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <Label htmlFor="otp">{t("auth.otp.label")}</Label>
 * <OtpField id="otp" name="code" autoFocus />
 * @example
 * <OtpField
 * 	id="otp"
 * 	name="code"
 * 	aria-describedby="otp-error"
 * 	aria-invalid="true"
 * />
 * <FieldError id="otp-error">{t("auth.otp.invalid")}</FieldError>
 * @example
 * <OtpField
 * 	id="invite-code"
 * 	name="inviteCode"
 * 	length={8}
 * 	inputMode="text"
 * 	autoComplete="off"
 * 	pattern="[A-Za-z0-9]*"
 * />
 */
export function OtpField(handle: Handle<OtpField.Props>) {
	return () => {
		let { length, inputMode, autoComplete, mix, ...rest } = handle.props;
		let resolvedLength = length ?? DEFAULT_LENGTH;
		let resolvedInputMode = inputMode ?? DEFAULT_INPUT_MODE;
		let resolvedAutoComplete = autoComplete ?? DEFAULT_AUTO_COMPLETE;

		return (
			<Input
				{...rest}
				type="text"
				inputMode={resolvedInputMode}
				autoComplete={resolvedAutoComplete}
				maxLength={resolvedLength}
				data-slot="otp-field"
				mix={[textAlign("center"), weight(500), tabularNums(), text("base"), mix]}
			/>
		);
	};
}
