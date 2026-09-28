/**
 * A form field schema that parses an email address the way a subject identifier folds it,
 * so a form refuses an address with the screen's own message before it reaches the tenant
 * object that would refuse it as an invalid identifier.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailAddress } from "@sdxc/email-address";
import type { Schema } from "remix/data-schema";

import { parseEmailAddress } from "@sdxc/email-address";
import { isFailure } from "@sdxc/result";
import { createSchema, fail } from "remix/data-schema";

/**
 * Parses a submitted address, trimmed and NFKC-normalized, into its parts; its `address` is
 * what a form stores and mails, and its `canonical` form is what uniqueness is keyed on.
 *
 * @param message - The screen's localized refusal, shown on the field.
 * @returns A schema for `f.field(...)`.
 * @example email: f.field(emailAddress(t("hostedSignUp.errors.identifierInvalid")))
 */
export function emailAddress(message: string): Schema<unknown, EmailAddress> {
	return createSchema(function validate(value, context) {
		if (typeof value !== "string") return fail(message, context.path);

		let parsed = parseEmailAddress(value);
		if (isFailure(parsed)) return fail(message, context.path);

		return { value: parsed.data };
	});
}
