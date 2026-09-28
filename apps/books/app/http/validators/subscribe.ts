/**
 * Validator for the newsletter, sample-chapter and upgrade forms: an email address plus the
 * optional UTM attribution the pages carry through as hidden fields, and the screening the
 * two list-joining forms run on top: disposable domains and mistyped providers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailAddress } from "@sdxc/email-address";
import type { Result } from "@sdxc/result";

import { checkDisposable } from "@sdxc/email-address/disposable";
import { suggestDomain } from "@sdxc/email-address/typo";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { emailAddress } from "~/app/http/validators/email-address";

/**
 * The copy a visitor reads when the address fails validation. Since only
 * `email` can fail, the controller shows this exact message for any
 * validation issue, keeping the wording reader-friendly.
 */
export const INVALID_EMAIL_MESSAGE = "Invalid email address";

/** The copy for an address on a throwaway-inbox domain, which could never receive the list. */
export const DISPOSABLE_EMAIL_MESSAGE =
	"Temporary inboxes can't receive the newsletter.\nPlease use an email address you'll keep.";

/**
 * The shape the forms post: the address, the UTM fields the pages carry through, and
 * `confirmed`, the address a typo suggestion was last shown for.
 */
export const SubscribeSchema = f.object({
	email: f.field(emailAddress()),
	confirmed: f.field(s.optional(s.string())),
	source: f.field(s.optional(s.string())),
	campaign: f.field(s.optional(s.string())),
	medium: f.field(s.optional(s.string())),
	referral: f.field(s.optional(s.string())),
});

/** The validated subscribe payload, as controllers and use cases receive it. */
export type SubscribeInput = s.InferOutput<typeof SubscribeSchema>;

/** Why a parsed address was held back from joining the list, with the copy to show for it. */
export class SubscriberEmailError extends Error {
	override name = "SubscriberEmailError";

	/**
	 * `disposable` refuses the address outright; `typo` asks the visitor to check it once,
	 * and resubmitting the same address accepts it.
	 */
	readonly reason: "disposable" | "typo";

	/**
	 * @param reason - Which screen held the address back.
	 * @param message - The visitor-facing copy.
	 */
	constructor(reason: "disposable" | "typo", message: string) {
		super(message);
		this.reason = reason;
	}
}

/**
 * A mistyped provider is held back once with a "did you mean" prompt, and resubmitting it
 * unchanged (`confirmed`) keeps it. The prompt runs first because the disposable list carries
 * typo domains such as `gmial.com`, where the correction helps a visitor more than a refusal.
 *
 * @param payload - The validated form payload.
 * @returns The address to subscribe, or the reason to show the form again.
 */
export function screenSubscriberEmail(
	payload: SubscribeInput,
): Result<EmailAddress, SubscriberEmailError> {
	let suggestion =
		payload.confirmed === payload.email.address ? null : suggestDomain(payload.email);
	if (suggestion) {
		return failure(
			new SubscriberEmailError(
				"typo",
				`Did you mean ${suggestion.address}?\nFix the address, or submit it again to keep it as it is.`,
			),
		);
	}

	let disposable = checkDisposable(payload.email);
	if (isFailure(disposable)) {
		return failure(new SubscriberEmailError("disposable", DISPOSABLE_EMAIL_MESSAGE));
	}

	return success(payload.email);
}
