/**
 * The email-address schema every form and query parameter on the site parses through.
 * It accepts exactly what `parseEmailAddress()` accepts, so the address a visitor gives is
 * checked by one rule whether it reaches the newsletter or the billing platform.
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
 * A string parsed into an `EmailAddress`: trimmed, NFKC-normalized and with its domain in
 * ASCII. A refusal's issue carries the parser's `reason` as its `code`, for the log.
 *
 * @returns A schema whose output's `address` is the form to deliver to.
 */
export function emailAddress(): Schema<unknown, EmailAddress> {
	return createSchema((value, context) => {
		if (typeof value !== "string") return fail("Expected string", context.path);

		let parsed = parseEmailAddress(value);
		if (isFailure(parsed)) {
			return fail("Invalid email address", context.path, { code: parsed.error.reason });
		}

		return { value: parsed.data };
	});
}
