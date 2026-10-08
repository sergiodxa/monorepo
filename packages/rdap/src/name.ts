/**
 * Turns the name a caller wrote into the A-label form a registry is queried with,
 * through the WHATWG host parser so an internationalized name converts the way a
 * browser converts it, and refuses anything that is not a multi-label host name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { RDAPError } from "./error.js";

/** Characters that would end the host inside a URL, so their presence means the input is more than a name. */
const URL_DELIMITERS = /[\s/?#@:\\[\]%]/;

/** A name in the form a registry is queried with, and its labels for suffix matching. */
export interface DomainName {
	/** A-label form, lowercased, no trailing dot. */
	name: string;
	labels: string[];
}

/**
 * Normalizes a domain: trimmed, one trailing dot dropped, lowercased and converted to
 * its A-label form. A single label, an empty label and an address literal all fail
 * `invalid-domain`, since none of them is a name a registry holds.
 *
 * @param input - The name as the caller wrote it.
 * @returns The normalized name and its labels.
 */
export function domainName(input: string): Result<DomainName, RDAPError> {
	let invalid = failure(
		new RDAPError("invalid-domain", `${JSON.stringify(input)} is not a domain name`, {
			domain: input,
		}),
	);

	let trimmed = input.trim();
	if (trimmed.endsWith(".")) trimmed = trimmed.slice(0, -1);
	trimmed = trimmed.toLowerCase();
	if (trimmed === "" || URL_DELIMITERS.test(trimmed)) return invalid;

	let candidate = `http://${trimmed}/`;
	if (!URL.canParse(candidate)) return invalid;

	let name = new URL(candidate).hostname;
	let labels = name.split(".");
	if (labels.length < 2 || labels.some((label) => label === "")) return invalid;
	if (/^\d+$/.test(labels.at(-1) ?? "")) return invalid;

	return success({ name, labels });
}

/**
 * Finds the entry whose label sequence is the longest suffix of the name, the
 * matching rule RFC 9224 gives for the DNS bootstrap registry.
 *
 * @param labels - The name's labels, left to right.
 * @param entries - Base URLs keyed by lowercased label sequence.
 * @returns The matched entry's value, or `undefined` when no suffix is listed.
 * @template T - What each entry holds.
 */
export function longestSuffix<T>(labels: string[], entries: Map<string, T>): T | undefined {
	for (let start = 0; start < labels.length; start++) {
		let found = entries.get(labels.slice(start).join("."));
		if (found !== undefined) return found;
	}
	return undefined;
}

/**
 * Folds a label sequence written by IANA or a caller onto the form `longestSuffix`
 * compares: lowercased, without leading or trailing dots.
 *
 * @param suffix - A TLD or label sequence such as `com` or `.co.uk`.
 */
export function suffixKey(suffix: string): string {
	return suffix
		.trim()
		.toLowerCase()
		.replace(/^\.+|\.+$/g, "");
}
