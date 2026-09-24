/**
 * Builds the `List-Unsubscribe`, `List-Unsubscribe-Post` and `List-Id` headers from a
 * message's structured options, so every sender gets the syntax RFC 2369, RFC 8058 and
 * RFC 2919 require and a non-compliant target fails the send instead of the button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { MailingList, Unsubscribe } from "../types.js";

import { MailError } from "../errors.js";

import { formatAddress, isValidAddress } from "./address.js";

/** RFC 8058's fixed `List-Unsubscribe-Post` value, the only one providers act on. */
const ONE_CLICK = "List-Unsubscribe=One-Click";

/** RFC 2919 list-id: dot-atom text with at least two labels. */
const LIST_ID = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)+$/;

/** Control characters, which would split a header line or smuggle another header in. */
const CONTROL_CHARACTERS = /\p{Cc}/u;

/**
 * Finds a caller-written header with the given name, compared case-insensitively as
 * mail header names are, so a hand-written `list-id` conflicts with the generated one.
 */
function findHeader(headers: Record<string, string>, names: string[]): string | undefined {
	return Object.keys(headers).find((key) => names.includes(key.toLowerCase()));
}

/**
 * Resolves the unsubscribe target into its `List-Unsubscribe` value. The HTTPS URL
 * comes first because RFC 8058 one-click requires it; a bare `mailto` address gets a
 * subject so a client that composes the mail sends something a list server recognizes.
 */
function unsubscribeValue(unsubscribe: Unsubscribe): Result<string, MailError> {
	let url = URL.parse(unsubscribe.url);
	if (url?.protocol !== "https:") {
		return failure(new MailError(`The unsubscribe URL "${unsubscribe.url}" must be https:.`));
	}

	let uris = [url.href];
	if (unsubscribe.mailto !== undefined) {
		let mailto = mailtoUri(unsubscribe.mailto);
		if (mailto === null) {
			return failure(new MailError(`"${unsubscribe.mailto}" is not an unsubscribe address.`));
		}
		uris.push(mailto);
	}

	return success(uris.map((uri) => `<${uri}>`).join(", "));
}

/**
 * Turns the `mailto` option into a URI, or `null` when it names no routable address.
 * A full URI keeps whatever query its author chose, normalized only by URL parsing so
 * it cannot break out of its angle brackets.
 */
function mailtoUri(mailto: string): string | null {
	if (!/^mailto:/i.test(mailto)) {
		if (!isValidAddress({ email: mailto })) return null;
		return `mailto:${mailto}?subject=unsubscribe`;
	}

	let url = URL.parse(mailto);
	if (!url || !isValidAddress({ email: decodeURIComponent(url.pathname) })) return null;
	return url.href;
}

/**
 * Formats `List-Id`, whose id always sits in angle brackets, quoting a description the
 * same way a mailbox's display name is quoted.
 */
function listIdValue(list: MailingList): Result<string, MailError> {
	if (!LIST_ID.test(list.id)) {
		return failure(new MailError(`"${list.id}" is not a valid list id.`));
	}
	if (list.name !== undefined && CONTROL_CHARACTERS.test(list.name)) {
		return failure(new MailError("A list name cannot contain control characters."));
	}
	if (!list.name?.trim()) return success(`<${list.id}>`);
	return success(formatAddress({ email: list.id, name: list.name }));
}

/**
 * Generates the list headers a message's options ask for. A caller-written header that
 * a set option would also generate fails the send, so a half-migrated email reports the
 * mistake instead of shipping two different unsubscribe targets.
 *
 * @param headers - Every header already merged for the message: mailer, message and email.
 * @param options - The message's `unsubscribe` and `list` options.
 * @returns The headers to add, or a `MailError` naming the invalid option or the conflict.
 */
export function buildListHeaders(
	headers: Record<string, string>,
	options: { unsubscribe: Unsubscribe | null; list: MailingList | null },
): Result<Record<string, string>, MailError> {
	let generated: Record<string, string> = {};

	if (options.unsubscribe) {
		let conflict = findHeader(headers, ["list-unsubscribe", "list-unsubscribe-post"]);
		if (conflict) {
			return failure(
				new MailError(`The "${conflict}" header conflicts with the unsubscribe option.`),
			);
		}

		let value = unsubscribeValue(options.unsubscribe);
		if (isFailure(value)) return value;
		generated["List-Unsubscribe"] = value.data;
		if (options.unsubscribe.oneClick !== false) generated["List-Unsubscribe-Post"] = ONE_CLICK;
	}

	if (options.list) {
		let conflict = findHeader(headers, ["list-id"]);
		if (conflict) {
			return failure(new MailError(`The "${conflict}" header conflicts with the list option.`));
		}

		let value = listIdValue(options.list);
		if (isFailure(value)) return value;
		generated["List-Id"] = value.data;
	}

	return success(generated);
}
