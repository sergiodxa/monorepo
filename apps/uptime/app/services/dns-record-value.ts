/**
 * Normalization of DNS record names and RDATA into the exact strings stored as a tracked
 * record's identity. A record is identified by `(name, type, value)`, so two spellings of
 * one record — a zone file's `2001:DB8::1` and a resolver's `2001:db8::1` — must fold to
 * the same bytes or the diff invents an addition and a removal on every check.
 *
 * Both input channels — a zone file and a resolver — read RDATA into typed fields with the
 * same codec and print them through {@link storedRecordValue}, so they agree on what a
 * record's value is by construction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ZoneFile } from "@sdxc/zone-file";

import { isSuccess } from "@sdxc/result";
import { formatRecordData, parseRecordData } from "@sdxc/zone-file";

/** The record types tracked by a domain monitor, and the only ones normalized here. */
export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA"] as const;

/** One tracked record type. */
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/** Whether a string names a tracked record type, narrowing it for callers that parse text. */
export function isDnsRecordType(value: string): value is DnsRecordType {
	return (DNS_RECORD_TYPES as readonly string[]).includes(value);
}

/**
 * Folds a domain name to the stored spelling: lowercased, with the root label's trailing
 * dot dropped, since DNS names are case-insensitive and a trailing dot is mere punctuation.
 * The root (`.`) keeps its dot — a legitimate RFC 7505 target — so it isn't folded to empty.
 *
 * @param name - A domain name in presentation form, absolute or not.
 * @returns The folded name, without a trailing dot. The root (`.`) is returned unchanged.
 */
export function normalizeDnsName(name: string): string {
	let value = name.trim().toLowerCase();
	return value.endsWith(".") && value.length > 1 ? value.slice(0, -1) : value;
}

/**
 * Reads TXT presentation data into its text: the character-strings concatenated with the
 * quoting and escapes removed, since a TXT record over 255 bytes arrives as several quoted
 * chunks that must be rejoined to recover it. `null` when the data is not valid TXT.
 */
function readTxtText(data: string): string | null {
	let parsed = parseRecordData("TXT", data);
	return isSuccess(parsed) ? parsed.data.text : null;
}

/**
 * The value stored for a record's typed data, whether a zone file or a resolver supplied it:
 * MX as `preference host`, TXT joined, CAA printed as `flags tag "value"`. The codec has
 * already canonicalized AAAA and folded the names.
 */
export function storedRecordValue(record: ZoneFile.RecordData<DnsRecordType>): string {
	switch (record.type) {
		case "A":
		case "AAAA":
			return record.address;
		case "CNAME":
			return record.target;
		case "NS":
			return record.host;
		case "MX":
			return `${record.preference} ${record.exchange}`;
		case "TXT":
			return record.text;
		case "CAA":
			return formatRecordData(record);
	}
}

/**
 * Normalizes one record's RDATA into the value stored as part of its identity, always
 * returning a string, since dropping data that fails to parse would report a record the
 * customer still publishes as `missing` — a false alert — where folding it instead only risks a record that never appears to change.
 *
 * @param type - The record's type.
 * @param data - RDATA in presentation form, as a resolver answers it or a zone file writes it.
 * @returns The stored value; unparseable data comes back folded as far as it can be.
 * @example normalizeDnsRecordValue("MX", "05 ALT1.aspmx.l.google.com.") // "5 alt1.aspmx.l.google.com"
 */
export function normalizeDnsRecordValue(type: DnsRecordType, data: string): string {
	let value = data.trim();
	/**
	 * Unquoted TXT is one string, spaces kept: it is what a person types into an expected-value
	 * box, and reading it as several character-strings would fold `v=spf1 -all` to `v=spf1-all`.
	 */
	if (type === "TXT" && value.length > 0 && !value.includes('"')) return value;

	let parsed = parseRecordData(type, value);
	if (isSuccess(parsed)) return storedRecordValue(parsed.data);

	switch (type) {
		case "A":
			return value;

		/** Unparsed AAAA data gets only a lowercase fold, since canonicalization requires a valid address to work from. */
		case "AAAA":
			return value.toLowerCase();

		case "CNAME":
		case "NS":
			return normalizeDnsName(value);

		/**
		 * A value with no whitespace is read as a bare mail host and carried through as one: the
		 * resolver never answers that shape, but a hand-typed expected value does, and inventing
		 * a preference for it or dropping it would both be worse than keeping it.
		 */
		case "MX": {
			let separator = value.search(/\s/);
			if (separator === -1) return normalizeDnsName(value);

			let preference = value.slice(0, separator);
			let host = normalizeDnsName(value.slice(separator + 1));
			/** Re-printed only when it is a number, so a malformed preference keeps its text. */
			let parsedPreference = Number(preference);
			if (!Number.isInteger(parsedPreference) || parsedPreference < 0) {
				return `${preference} ${host}`;
			}
			return `${parsedPreference} ${host}`;
		}

		/** An unclosed final quote is the usual failure, so closing it recovers what was published. */
		case "TXT":
			return readTxtText(`${value}"`) ?? value;

		case "CAA":
			return value;
	}
}
