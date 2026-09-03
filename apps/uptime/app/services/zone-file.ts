/**
 * Parser for a pasted BIND zone file, which is the only channel through which the set of
 * *names* in a zone can reach this app — DNS refuses to enumerate a zone from outside it.
 * It reads the smallest subset that covers a provider export and reports every other line
 * with its number and a reason, so an import can never quietly cover less than it claims.
 *
 * The pasted text is parsed and discarded: nothing here retains it, and callers persist
 * only the records this returns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { DnsRecordType } from "~/app/lib/dns-record-value";

import { isDnsRecordType, normalizeDnsName, parseDnsRecordValue } from "~/app/lib/dns-record-value";

/**
 * Largest paste that is parsed at all, in bytes — the same ceiling DNS providers put on a
 * zone file. Past it, the whole text is refused: a half-read zone would produce a review
 * screen that looks complete while actually missing records.
 */
export const MAX_ZONE_FILE_BYTES = 256 * 1024;

/**
 * How much of a reported line is echoed back. A rejected line is shown so it can be
 * recognised in the file the user still has open, and a report traveling between a
 * request and a page stays small — it is a copy of somebody's zone either way.
 */
const MAX_REPORTED_INPUT_LENGTH = 120;

/** Classes a zone line may name. Only `IN` is the internet; the rest are reported. */
const RECORD_CLASSES = new Set(["IN", "CH", "HS", "CS"]);

/**
 * Record types this parser recognises without tracking. Telling them apart from a typo
 * gives a `CAA` line its own reported reason, since a real gap in coverage and a genuine
 * typo call for different fixes from the user.
 */
const KNOWN_UNTRACKED_TYPES = new Set([
	"AFSDB",
	"ALIAS",
	"APL",
	"CAA",
	"CDNSKEY",
	"CDS",
	"CERT",
	"DNAME",
	"DNSKEY",
	"DS",
	"HINFO",
	"HTTPS",
	"IPSECKEY",
	"KX",
	"LOC",
	"NAPTR",
	"NSEC",
	"NSEC3",
	"NSEC3PARAM",
	"OPENPGPKEY",
	"PTR",
	"RP",
	"RRSIG",
	"SMIMEA",
	"SOA",
	"SPF",
	"SRV",
	"SSHFP",
	"SVCB",
	"TLSA",
	"URI",
]);

/** Why one line of a pasted zone file did not become a tracked record. */
export type ZoneFileRejectionReason =
	| "originDirective"
	| "ttlDirective"
	| "includeDirective"
	| "generateDirective"
	| "unsupportedDirective"
	| "multiLineRecord"
	| "blankOwnerContinuation"
	| "nonInternetClass"
	| "unsupportedType"
	| "outOfZone"
	| "malformed";

/** One record a zone file declared, named and normalized the way it will be stored. */
export interface ZoneFileRecord {
	/** 1-based position in the paste, so a report points at a line somebody can find. */
	line: number;
	/** Absolute owner name, lowercased, without a trailing dot. */
	name: string;
	type: DnsRecordType;
	/** Normalized RDATA, byte-identical to what resolving the same record produces. */
	value: string;
}

/** One line that did not become a record, and why. */
export interface ZoneFileRejection {
	line: number;
	/** The line as pasted, trimmed and truncated, kept only for display in the response. */
	input: string;
	reason: ZoneFileRejectionReason;
}

/** A line declaring a record an earlier line already declared. Informational: the record is imported. */
export interface ZoneFileDuplicate {
	line: number;
	input: string;
	/** The line that first declared this record, which is the one that was kept. */
	firstLine: number;
	name: string;
	type: DnsRecordType;
}

/** What one pasted zone file amounts to: the records to review, and the lines it rejected. */
export interface ZoneFileImport {
	records: ZoneFileRecord[];
	rejected: ZoneFileRejection[];
	/**
	 * Repeated declarations of a record already in {@link ZoneFileImport.records}. Kept apart
	 * from the rejections since a repeat costs nothing: DNS answers such an RRset once, so an
	 * export that lists a record twice still imports it completely.
	 */
	duplicates: ZoneFileDuplicate[];
}

/** A paste larger than {@link MAX_ZONE_FILE_BYTES}, refused before any of it is parsed. */
export class ZoneFileTooLargeError extends Error {
	override name = "ZoneFileTooLargeError";

	constructor(
		/** Size of the refused paste, in bytes. */
		readonly bytes: number,
	) {
		super(`Zone file is ${bytes} bytes, over the ${MAX_ZONE_FILE_BYTES} byte limit`);
	}
}

/** One whitespace-separated field of a zone line, remembering whether it arrived quoted. */
interface ZoneToken {
	value: string;
	quoted: boolean;
}

/** A zone line split into fields, plus the structure that decides whether it can be read at all. */
interface TokenizedLine {
	tokens: ZoneToken[];
	/** An unclosed `(` marks a multi-line record; each of its lines is reported individually. */
	openParen: boolean;
	closeParen: boolean;
	unterminatedQuote: boolean;
}

/**
 * Splits one line into fields, dropping the `;` comment that ends it. Quoting is tracked
 * so a `;` inside a quoted string, like `"v=spf1 a; mx; ~all"`, is preserved as data.
 * Each field remembers whether it was quoted, since only a TXT character-string is defined by its quotes.
 */
function tokenize(line: string): TokenizedLine {
	let tokens: ZoneToken[] = [];
	let openParen = false;
	let closeParen = false;
	let unterminatedQuote = false;

	let current = "";
	let started = false;
	let quoted = false;

	function flush() {
		if (!started) return;
		tokens.push({ value: current, quoted });
		current = "";
		started = false;
		quoted = false;
	}

	for (let index = 0; index < line.length; index++) {
		let char = line[index] ?? "";

		if (char === '"') {
			started = true;
			quoted = true;
			current += char;
			index += 1;

			let closedAt = -1;
			for (; index < line.length; index++) {
				let inner = line[index] ?? "";
				if (inner === "\\") {
					current += inner + (line[index + 1] ?? "");
					index += 1;
					continue;
				}
				current += inner;
				if (inner === '"') {
					closedAt = index;
					break;
				}
			}

			if (closedAt === -1) unterminatedQuote = true;
			flush();
			continue;
		}

		if (char === ";") break;

		if (char === "(" || char === ")") {
			flush();
			if (char === "(") openParen = true;
			else closeParen = true;
			continue;
		}

		if (char === " " || char === "\t" || char === "\r") {
			flush();
			continue;
		}

		started = true;
		current += char;
	}

	flush();

	return { tokens, openParen, closeParen, unterminatedQuote };
}

/** Shortens a line for the report, so one pathological paste cannot bloat what is carried. */
function forReport(line: string): string {
	let value = line.trim();
	return value.length <= MAX_REPORTED_INPUT_LENGTH
		? value
		: value.slice(0, MAX_REPORTED_INPUT_LENGTH);
}

/**
 * Resolves a name field to the absolute name it denotes, given the monitor's domain. A
 * dotless field that already spells out the zone is taken as absolute, since provider
 * exports are inconsistent about the apex's trailing dot and no real zone owns a name that repeats itself this way.
 */
function qualifyName(field: string, domain: string): string {
	if (field === "@") return domain;
	if (field.endsWith(".")) return normalizeDnsName(field);

	let relative = field.toLowerCase();
	if (relative === domain || relative.endsWith(`.${domain}`)) return relative;

	return `${relative}.${domain}`;
}

/**
 * Resolves an owner, which must belong to the monitor's zone.
 *
 * @returns The absolute name, or `null` when it falls outside the monitor's domain.
 */
function resolveOwner(owner: string, domain: string): string | null {
	let name = qualifyName(owner, domain);

	if (name.length === 0) return null;
	/** A zone file for one domain only enrols names inside that same domain. */
	if (name !== domain && !name.endsWith(`.${domain}`)) return null;

	return name;
}

/** Rebuilds the RDATA of a hostname-shaped record with its target qualified against the zone. */
function qualifyRecordData(
	type: DnsRecordType,
	tokens: ZoneToken[],
	domain: string,
): string | null {
	if (type === "CNAME" || type === "NS") {
		if (tokens.length !== 1) return null;
		let target = tokens[0];
		if (!target || target.quoted) return null;
		return qualifyName(target.value, domain);
	}

	if (type === "MX") {
		if (tokens.length !== 2) return null;
		let [preference, host] = tokens;
		if (!preference || !host || preference.quoted || host.quoted) return null;
		return `${preference.value} ${qualifyName(host.value, domain)}`;
	}

	if (type === "TXT") return tokens.map((token) => token.value).join(" ");

	/** Address types take exactly one literal; a second field means the line is malformed. */
	if (tokens.length !== 1) return null;
	let literal = tokens[0];
	if (!literal || literal.quoted) return null;
	return literal.value;
}

/** Maps a `$` directive to the reason it is refused, each of which would otherwise import a different zone. */
function directiveReason(directive: string): ZoneFileRejectionReason {
	switch (directive.toUpperCase()) {
		case "$ORIGIN":
			return "originDirective";
		case "$TTL":
			return "ttlDirective";
		case "$INCLUDE":
			return "includeDirective";
		case "$GENERATE":
			return "generateDirective";
		default:
			return "unsupportedDirective";
	}
}

/**
 * Reads a pasted zone file into the records it declares and the lines it rejects. Every
 * unsupported line comes back in {@link ZoneFileImport.rejected} with a reason, since an
 * import that decides what gets monitored is the worst place for a silent omission.
 *
 * @param input - The raw contents of the paste box. It is read here and not retained.
 * @param domain - The monitor's domain, which relative owners and `@` resolve against.
 * @returns The declared records and the reported lines, or a failure when the paste is too large.
 * @example parseZoneFile("@\t1\tIN\tA\t192.0.2.1", "example.com") // 1 record at example.com
 */
export function parseZoneFile(
	input: string,
	domain: string,
): Result<ZoneFileImport, ZoneFileTooLargeError> {
	let bytes = new TextEncoder().encode(input).byteLength;
	if (bytes > MAX_ZONE_FILE_BYTES) return failure(new ZoneFileTooLargeError(bytes));

	let zone = normalizeDnsName(domain);
	let records: ZoneFileRecord[] = [];
	let rejected: ZoneFileRejection[] = [];
	let duplicates: ZoneFileDuplicate[] = [];
	/** Identities already declared, mapped to the line that declared them, so a repeat can point back. */
	let seen = new Map<string, number>();

	let lines = input.split(/\r?\n/);
	/** Set by an unclosed `(`: the record's remaining lines are reported as unsupported too. */
	let insideMultiLine = false;

	for (let index = 0; index < lines.length; index++) {
		let line = index + 1;
		let raw = lines[index] ?? "";
		let { tokens, openParen, closeParen, unterminatedQuote } = tokenize(raw);

		function reject(reason: ZoneFileRejectionReason) {
			rejected.push({ line, input: forReport(raw), reason });
		}

		if (insideMultiLine) {
			reject("multiLineRecord");
			if (closeParen) insideMultiLine = false;
			continue;
		}

		/** A blank or comment-only line is how a file breathes, and is skipped silently. */
		if (tokens.length === 0 && !openParen && !closeParen) continue;

		if (openParen) {
			reject("multiLineRecord");
			insideMultiLine = !closeParen;
			continue;
		}

		if (unterminatedQuote || closeParen) {
			reject("malformed");
			continue;
		}

		if (/^[ \t]/.test(raw)) {
			reject("blankOwnerContinuation");
			continue;
		}

		let owner = tokens[0];
		if (!owner || owner.quoted) {
			reject("malformed");
			continue;
		}

		if (owner.value.startsWith("$")) {
			reject(directiveReason(owner.value));
			continue;
		}

		/**
		 * TTL and class are both optional and may be written in either order, so they are
		 * consumed by what they look like: the type is the first field that is neither a
		 * duration nor a class name.
		 */
		let cursor = 1;
		let ttlSeen = false;
		let recordClass: string | null = null;

		while (cursor < tokens.length) {
			let token = tokens[cursor];
			if (!token || token.quoted) break;

			let upper = token.value.toUpperCase();

			if (!ttlSeen && /^\d+[SMHDW]?$/.test(upper)) {
				ttlSeen = true;
				cursor += 1;
				continue;
			}

			if (recordClass === null && RECORD_CLASSES.has(upper)) {
				recordClass = upper;
				cursor += 1;
				continue;
			}

			break;
		}

		if (recordClass !== null && recordClass !== "IN") {
			reject("nonInternetClass");
			continue;
		}

		let typeToken = tokens[cursor];
		if (!typeToken || typeToken.quoted) {
			reject("malformed");
			continue;
		}

		let type = typeToken.value.toUpperCase();

		if (!isDnsRecordType(type)) {
			/** A known-but-untracked type is reported with its own reason, distinct from an unreadable line. */
			let known = KNOWN_UNTRACKED_TYPES.has(type) || /^TYPE\d+$/.test(type);
			reject(known ? "unsupportedType" : "malformed");
			continue;
		}

		let data = tokens.slice(cursor + 1);
		if (data.length === 0) {
			reject("malformed");
			continue;
		}

		let name = resolveOwner(owner.value, zone);
		if (name === null) {
			reject("outOfZone");
			continue;
		}

		let qualified = qualifyRecordData(type, data, zone);
		if (qualified === null) {
			reject("malformed");
			continue;
		}

		/**
		 * The strict reading: an import is the one channel with somewhere to put a refusal, so a
		 * line whose RDATA fails its type's format is reported by line number and left out of
		 * the records the zone ends up monitored for.
		 */
		let value = parseDnsRecordValue(type, qualified);
		if (value === null) {
			reject("malformed");
			continue;
		}

		let identity = `${name} ${type} ${value}`;
		let firstLine = seen.get(identity);

		/**
		 * A repeat is recorded as a duplicate: identity is `(name, type, value)`, and DNS answers
		 * such an RRset once, so a second row would only restate a record that already exists.
		 */
		if (firstLine !== undefined) {
			duplicates.push({ line, input: forReport(raw), firstLine, name, type });
			continue;
		}

		seen.set(identity, line);
		records.push({ line, name, type, value });
	}

	return success({ records, rejected, duplicates });
}
