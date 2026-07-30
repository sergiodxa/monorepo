/**
 * Address helpers used by the mailer's normalization and by transports that talk
 * in address strings. They keep the single-or-list shape of the public `Message`
 * out of every consumer and centralize how a display name is quoted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "../types";

/** Characters that force a display name to be quoted in a mailbox string. */
const SPECIAL_CHARACTERS = /[()<>[\]:;@\\,."]/;

/** Shape of an address that a provider can route: one `@`, no whitespace, both sides present. */
const MAILBOX = /^[^\s@]+@[^\s@]+$/;

/**
 * Coerces the single-or-list shape callers write into the list shape transports
 * read, treating a missing value as no recipients rather than as an error.
 *
 * @param value - One address, several addresses, or nothing.
 * @returns A new array; never the caller's own array, so later mutation cannot leak.
 */
export function toAddressList(value: Address | Address[] | undefined): Address[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) return [...value];
	return [value];
}

/**
 * Formats an address as an RFC 5322 mailbox. A display name is quoted only when
 * it contains characters that would otherwise change how the mailbox parses, so
 * ordinary names stay readable in raw headers.
 *
 * @param address - The mailbox to format.
 * @returns `user@example.com` without a name, `Name <user@example.com>` with one.
 * @example formatAddress({ email: "a@b.com", name: "Ada" }); // 'Ada <a@b.com>'
 */
export function formatAddress(address: Address): string {
	let name = address.name?.trim();
	if (!name) return address.email;
	if (!SPECIAL_CHARACTERS.test(name)) return `${name} <${address.email}>`;
	let quoted = name.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
	return `"${quoted}" <${address.email}>`;
}

/**
 * Reports whether an address is routable enough to hand to a provider. The check
 * is deliberately structural rather than a full grammar: it rejects the mistakes
 * that produce silent non-delivery (empty, unsplit, or whitespace-bearing values)
 * without second-guessing which domains exist.
 *
 * @param address - The mailbox to check.
 * @returns `true` when the address has a local part and a domain around one `@`.
 */
export function isValidAddress(address: Address): boolean {
	return MAILBOX.test(address.email);
}
