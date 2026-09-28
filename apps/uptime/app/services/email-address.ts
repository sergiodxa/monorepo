/**
 * The checks an accepted address goes through before this app sends to it: that its domain
 * receives mail, and for the public trial form also that it is not a disposable inbox and not
 * a mistyped provider. A resolver outage lets the address through, so a form keeps working.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailAddress } from "@sdxc/email-address";
import type { Result } from "@sdxc/result";

import { parseEmailAddress } from "@sdxc/email-address";
import { checkDisposable } from "@sdxc/email-address/disposable";
import { checkMailServer } from "@sdxc/email-address/mail-server";
import { suggestDomain } from "@sdxc/email-address/typo";
import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";

import { invalidField } from "~/app/services/api-problems";

/**
 * How long one mail-server lookup may take. A form waits on it, so it is kept short; a
 * lookup that times out counts as failed and lets the address through.
 */
const MAIL_SERVER_TIMEOUT_MS = 2_000;

/**
 * Why an address was refused: the parser refused it, it belongs to a disposable-inbox
 * service, its domain receives no mail, or it looks like a mistyped provider the sender
 * has not yet confirmed.
 */
export type EmailAddressRefusalReason = "invalid" | "disposable" | "no-mail-server" | "typo";

/** A refused address, with what the form needs to explain the refusal. */
export class EmailAddressRefusal extends Error {
	override name = "EmailAddressRefusal";

	readonly reason: EmailAddressRefusalReason;

	/** The domain the refusal is about, for the message a form renders. */
	readonly domain: string;

	/** The address the sender most likely meant, set only for `typo`. */
	readonly suggestion: string | null;

	/**
	 * @param reason - Which check refused.
	 * @param domain - The domain it refused.
	 * @param suggestion - The corrected address, for `typo`.
	 */
	constructor(reason: EmailAddressRefusalReason, domain: string, suggestion: string | null = null) {
		super(`Email address refused: ${reason} (${domain})`);
		this.reason = reason;
		this.domain = domain;
		this.suggestion = suggestion;
	}
}

/** The checks a form runs beyond parsing and the mail-server lookup, all off by default. */
export interface EmailAddressChecks {
	/** Refuse an address on the bundled disposable-inbox list. */
	disposable?: boolean;
	/** Refuse an address whose domain is one edit from a major provider, naming the fix. */
	typo?: boolean;
}

/**
 * Runs the checks that need no network first, then the mail-server lookup. A lookup that
 * fails lets the address through, logged as `email.mail_server_unknown`; a domain that
 * answers with no mail host, a null MX, or NXDOMAIN refuses it.
 *
 * @param input - The address as submitted.
 * @param checks - Which optional checks this form runs.
 * @returns The parsed address, or why it was refused.
 * @example await checkEmailAddress("jane@example.com", { disposable: true, typo: true });
 */
export async function checkEmailAddress(
	input: string,
	checks: EmailAddressChecks = {},
): Promise<Result<EmailAddress, EmailAddressRefusal>> {
	let parsed = parseEmailAddress(input);
	if (isFailure(parsed)) return failure(new EmailAddressRefusal("invalid", ""));

	let address = parsed.data;

	if (checks.typo) {
		let suggestion = suggestDomain(address);
		if (suggestion !== null) {
			return failure(new EmailAddressRefusal("typo", address.domain, suggestion.address));
		}
	}

	if (checks.disposable && isFailure(checkDisposable(address))) {
		return failure(new EmailAddressRefusal("disposable", address.domain));
	}

	let servers = await checkMailServer(address.domain, { timeoutMs: MAIL_SERVER_TIMEOUT_MS });
	if (isFailure(servers)) {
		if (servers.error.reason === "lookup-failed") {
			currentLog()?.warn("email.mail_server_unknown", { domain: address.domain });
			return success(address);
		}
		return failure(new EmailAddressRefusal("no-mail-server", address.domain));
	}

	return success(address);
}

/**
 * The API's answer to a recipient whose domain receives no mail: a `validation-error`
 * naming the field, as a schema failure reports. Every other address passes.
 *
 * @param email - An address the request body's schema already accepted.
 * @param pointer - JSON Pointer to the field that carried it.
 * @returns The problem response, or `null` when the address may be stored.
 * @example let refused = await refuseUndeliverableRecipient(body.email, "/email");
 */
export async function refuseUndeliverableRecipient(
	email: string,
	pointer: string,
): Promise<Response | null> {
	let checked = await checkEmailAddress(email);
	if (!isFailure(checked)) return null;
	return invalidField(`${checked.error.domain} does not accept email`, pointer);
}
