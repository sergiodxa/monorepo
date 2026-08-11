/**
 * Normalization of DNS record names and RDATA into the exact strings stored as a tracked
 * record's identity. A record is identified by `(name, type, value)`, so two spellings of one
 * record — a zone file's `2001:DB8::1` and a resolver's `2001:db8::1` — must fold to the same
 * bytes here or the diff invents an addition and a removal on every check.
 *
 * It lives apart from either input channel because both channels have to agree, and the only
 * way to guarantee that is to give them one implementation rather than two that match today.
 * For the same reason the strict and total readings of a value — {@link parseDnsRecordValue}
 * and {@link normalizeDnsRecordValue} — are one set of rules with two answers for data that
 * does not fit them, rather than two functions that could come to disagree about what fits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The record types tracked by a domain monitor, and the only ones normalized here. */
export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

/** One tracked record type. */
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/** Whether a string names a tracked record type, narrowing it for callers that parse text. */
export function isDnsRecordType(value: string): value is DnsRecordType {
	return (DNS_RECORD_TYPES as readonly string[]).includes(value);
}

/**
 * Folds a domain name to the stored spelling: lowercased, with the root label's trailing dot
 * dropped, so `Example.COM.` and `example.com` are one name.
 *
 * DNS itself is case-insensitive in names and the trailing dot is punctuation, not data, so
 * neither carries information worth keeping — while keeping either would make the same name
 * from two sources compare unequal.
 *
 * The root itself is the one name that keeps its dot: `.` is a name a record can legitimately
 * point at — RFC 7505 writes "this zone accepts no mail" as `MX 0 .` — and folding it to the
 * empty string would make the root indistinguishable from a missing name.
 *
 * @param name - A domain name in presentation form, absolute or not.
 * @returns The folded name, without a trailing dot. The root (`.`) is returned unchanged.
 */
export function normalizeDnsName(name: string): string {
	let value = name.trim().toLowerCase();
	return value.endsWith(".") && value.length > 1 ? value.slice(0, -1) : value;
}

/**
 * An IPv4 address in dotted-quad form, each octet 0-255 and written without leading zeros.
 *
 * Leading zeros are refused rather than trimmed: `inet_aton` reads `010` as octal and browsers
 * read it as decimal, so an address that carries them has no single meaning and guessing one
 * would store a value that never matches what resolves.
 */
const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Whether a string is a dotted-quad IPv4 literal this app will store as-is. */
export function isIpv4Address(value: string): boolean {
	return IPV4_PATTERN.test(value);
}

/** Reads a dotted quad into its four octets, or `null` when it is not one. */
function readIpv4(value: string): number[] | null {
	if (!isIpv4Address(value)) return null;
	return value.split(".").map((octet) => Number.parseInt(octet, 10));
}

/** Reads one side of an IPv6 literal into 16-bit groups, expanding a trailing dotted quad. */
function readIpv6Groups(part: string): number[] | null {
	if (part.length === 0) return [];

	let groups: number[] = [];
	let pieces = part.split(":");

	for (let index = 0; index < pieces.length; index++) {
		let piece = pieces[index] ?? "";

		/** A dotted quad is only legal as the address's last 32 bits. */
		if (piece.includes(".")) {
			if (index !== pieces.length - 1) return null;
			let quad = readIpv4(piece);
			if (!quad) return null;
			groups.push(((quad[0] ?? 0) << 8) | (quad[1] ?? 0), ((quad[2] ?? 0) << 8) | (quad[3] ?? 0));
			continue;
		}

		if (!/^[0-9a-f]{1,4}$/i.test(piece)) return null;
		groups.push(Number.parseInt(piece, 16));
	}

	return groups;
}

/**
 * Rewrites an IPv6 literal into the one canonical form of RFC 5952: lowercase hex, no leading
 * zeros in a group, and the longest run of zero groups — leftmost when two runs tie — collapsed
 * to `::`.
 *
 * An address has many legal spellings and a resolver answers with exactly one of them, so
 * every spelling has to be rewritten before it can be compared to an answer. A trailing dotted
 * quad is folded into hex groups for the same reason: it is a second spelling of the same 128
 * bits.
 *
 * @param value - An IPv6 literal in any legal presentation form, without a zone identifier.
 * @returns The canonical spelling, or `null` when the string is not an IPv6 address.
 * @example canonicalizeIpv6("2606:4700:3030:0:0:0:6815:3AF9") // "2606:4700:3030::6815:3af9"
 */
export function canonicalizeIpv6(value: string): string | null {
	let input = value.trim();
	/** A scope/zone identifier is meaningful only on the host that wrote it, never in a zone. */
	if (input.length === 0 || input.includes("%")) return null;

	let halves = input.split("::");
	if (halves.length > 2) return null;

	let head = readIpv6Groups(halves[0] ?? "");
	if (!head) return null;

	let groups: number[];

	if (halves.length === 1) {
		if (head.length !== 8) return null;
		groups = head;
	} else {
		let tail = readIpv6Groups(halves[1] ?? "");
		if (!tail) return null;
		/** `::` stands for at least one zero group, so a full eight groups leaves it nothing to say. */
		if (head.length + tail.length > 7) return null;
		groups = [...head, ...Array<number>(8 - head.length - tail.length).fill(0), ...tail];
	}

	let longestStart = -1;
	let longestLength = 0;
	let runStart = -1;

	for (let index = 0; index <= groups.length; index++) {
		if (index < groups.length && groups[index] === 0) {
			if (runStart === -1) runStart = index;
			continue;
		}

		if (runStart !== -1) {
			let length = index - runStart;
			/** Strictly greater keeps the leftmost run when two are the same length, per RFC 5952. */
			if (length > longestLength) {
				longestLength = length;
				longestStart = runStart;
			}
			runStart = -1;
		}
	}

	let pieces = groups.map((group) => group.toString(16));
	/** A single zero group is written `0`; `::` may only replace two or more. */
	if (longestLength < 2) return pieces.join(":");

	let before = pieces.slice(0, longestStart).join(":");
	let after = pieces.slice(longestStart + longestLength).join(":");
	return `${before}::${after}`;
}

/**
 * Reads TXT presentation data into its character-strings, reporting whether every quoted
 * string was closed. The text is returned either way, so a total caller can still carry an
 * unterminated value through while a strict one refuses it.
 */
function readCharacterStringsPartial(data: string): { text: string; closed: boolean } {
	let out = "";
	let index = 0;
	let closed = true;

	while (index < data.length) {
		let char = data[index] ?? "";

		if (char === " " || char === "\t") {
			index += 1;
			continue;
		}

		if (char === '"') {
			index += 1;
			let terminated = false;

			while (index < data.length) {
				let inner = data[index] ?? "";

				if (inner === "\\") {
					let next = data[index + 1] ?? "";
					out += next === '"' || next === "\\" ? next : `\\${next}`;
					index += 2;
					continue;
				}

				if (inner === '"') {
					terminated = true;
					index += 1;
					break;
				}

				out += inner;
				index += 1;
			}

			if (!terminated) closed = false;
			continue;
		}

		/** A bare word is a legal character-string; it simply cannot contain whitespace. */
		while (index < data.length) {
			let inner = data[index] ?? "";
			if (inner === " " || inner === "\t") break;
			out += inner;
			index += 1;
		}
	}

	return { text: out, closed };
}

/**
 * Splits TXT presentation data into its character-strings and concatenates them, quotes
 * removed and nothing inserted between the pieces.
 *
 * A TXT record over 255 bytes is several character-strings at the protocol level and arrives as
 * several quoted strings in one field, so the pieces have to be rejoined to get the record back.
 * Backslash escapes of a quote or of a backslash are unescaped; every other backslash is kept,
 * since it is data in SPF and DKIM payloads as often as it is punctuation.
 *
 * Case and whitespace inside a character-string are significant and are left byte-exact.
 *
 * @param data - The RDATA of a TXT record, one or more quoted or bare character-strings.
 * @returns The record's text, or `null` when a quoted string is never closed.
 * @example readCharacterStrings('"v=DKIM1; p=AAA" "BBB"') // "v=DKIM1; p=AAABBB"
 */
export function readCharacterStrings(data: string): string | null {
	let { text, closed } = readCharacterStringsPartial(data);
	return closed ? text : null;
}

/**
 * Reads one record's RDATA into the value stored as part of its identity, refusing data that
 * is not valid for the type.
 *
 * The rules are per type and are the whole of the contract between the two channels that
 * produce records — a resolver answer and a pasted zone file. Hostname-shaped data folds case
 * and the trailing dot; addresses fold to one canonical spelling; TXT keeps its bytes; MX keeps
 * its preference, because `10 mail` and `20 mail` are genuinely different records.
 *
 * This is the strict half of the pair, for the one caller that has somewhere to put a refusal:
 * a zone-file import reports the line it could not read, with its number, rather than importing
 * a record nobody wrote. Everywhere else the value is the identity and there is no such place,
 * which is what {@link normalizeDnsRecordValue} is for.
 *
 * @param type - The record's type.
 * @param data - RDATA in presentation form, as a resolver answers it or a zone file writes it.
 * @returns The stored value, or `null` when the data is not valid for the type.
 * @example parseDnsRecordValue("A", "999.1.1.1") // null
 */
export function parseDnsRecordValue(type: DnsRecordType, data: string): string | null {
	let value = data.trim();
	if (value.length === 0) return null;

	switch (type) {
		/** An address literal is stored as answered: there is one spelling and folding buys nothing. */
		case "A":
			return isIpv4Address(value) ? value : null;

		case "AAAA":
			return canonicalizeIpv6(value);

		case "CNAME":
		case "NS": {
			let name = normalizeDnsName(value);
			return name.length > 0 ? name : null;
		}

		case "MX": {
			let separator = value.search(/\s/);
			if (separator === -1) return null;

			let preference = value.slice(0, separator);
			if (!/^\d{1,5}$/.test(preference)) return null;

			let host = normalizeDnsName(value.slice(separator + 1));
			if (host.length === 0 || /\s/.test(host)) return null;

			/** Parsed and re-printed so `05` and `5` are one preference rather than two records. */
			return `${Number.parseInt(preference, 10)} ${host}`;
		}

		/**
		 * Unquoted data is one character-string that happens to contain spaces, not several: it
		 * is what a person types into an expected-value box and what a zone file writes for a
		 * short TXT, and splitting it on whitespace would fold `v=spf1 -all` to `v=spf1-all`
		 * while the resolver's own quoted answer keeps the space. Only quoting makes chunks.
		 */
		case "TXT":
			return value.includes('"') ? readCharacterStrings(value) : value;
	}
}

/**
 * Normalizes one record's RDATA into the value stored as part of its identity, always
 * returning a string.
 *
 * Total on purpose, and this is the decision the two halves of this module turn on. A record's
 * value *is* its identity, so on every path but one there is nowhere to report a refusal to:
 * a resolver answer that failed to parse could only be dropped from the RRset, and a dropped
 * value is indistinguishable from a record that no longer exists — the sweep would report a
 * record the customer still publishes as `missing` and alert on it. A value that normalizes
 * badly still compares stably against itself, so the worst case is a record that never appears
 * to change; the alternative's worst case is a false alert on a record nobody touched.
 *
 * The one caller with somewhere to put a refusal is the zone-file import, which reports the
 * line and its number, and it reaches for {@link parseDnsRecordValue} instead. Both are the
 * same rules — this one is defined as that one plus a fallback — so the two channels cannot
 * drift apart on what a record's value is, only on what they do when there isn't one.
 *
 * @param type - The record's type.
 * @param data - RDATA in presentation form, as a resolver answers it or a zone file writes it.
 * @returns The stored value; unparseable data comes back folded as far as it can be.
 * @example normalizeDnsRecordValue("MX", "05 ALT1.aspmx.l.google.com.") // "5 alt1.aspmx.l.google.com"
 */
export function normalizeDnsRecordValue(type: DnsRecordType, data: string): string {
	let parsed = parseDnsRecordValue(type, data);
	if (parsed !== null) return parsed;

	let value = data.trim();

	switch (type) {
		case "A":
			return value;

		/** Not an address, so there is no canonical form; case is folded and nothing else. */
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

		/** The only way TXT fails to parse is an unclosed quote; what was read is still the value. */
		case "TXT":
			return readCharacterStringsPartial(value).text;
	}
}
