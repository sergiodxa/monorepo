/**
 * Import policy for a pasted BIND zone file, the only channel through which the set of
 * *names* in a zone can reach this app — DNS refuses to enumerate a zone from outside it.
 * It keeps the tracked records inside the monitor's domain and reports every other entry
 * with its line and a reason, so an import can never quietly cover less than it claims.
 *
 * The pasted text is parsed and discarded: nothing here retains it, and callers persist
 * only the records this returns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ZoneFile } from "@sdxc/zone-file";

import { failure, isFailure, success } from "@sdxc/result";
import { parse } from "@sdxc/zone-file";

import type { DnsRecordType } from "~/app/lib/dns-record-value";

import { isDnsRecordType, normalizeDnsName, storedRecordValue } from "~/app/lib/dns-record-value";

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

/**
 * Record types recognised without being tracked. Telling them apart from a typo gives an
 * `SRV` line its own reported reason, since a real gap in coverage and a genuine typo call
 * for different fixes from the user.
 */
const KNOWN_UNTRACKED_TYPES = new Set([
	"AFSDB",
	"ALIAS",
	"APL",
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

/** Why one entry of a pasted zone file did not become a tracked record. */
export type ZoneFileRejectionReason =
	| "includeDirective"
	| "generateDirective"
	| "unsupportedDirective"
	| "nonInternetClass"
	| "unsupportedType"
	| "outOfZone"
	| "malformed";

/** One record a zone file declared, named and normalized the way it will be stored. */
export interface ZoneFileRecord {
	/**
	 * 1-based position in the paste, so a report points at a line somebody can find; a record
	 * spread over several lines with parentheses reports the line it starts on.
	 */
	line: number;
	/** Absolute owner name, lowercased, without a trailing dot. */
	name: string;
	type: DnsRecordType;
	/** Normalized RDATA, byte-identical to what resolving the same record produces. */
	value: string;
}

/** One entry that did not become a record, and why. */
export interface ZoneFileRejection {
	/** The line the entry starts on. */
	line: number;
	/** The entry as pasted, trimmed and truncated, kept only for display in the response. */
	input: string;
	reason: ZoneFileRejectionReason;
}

/** An entry declaring a record an earlier entry already declared. Informational: the record is imported. */
export interface ZoneFileDuplicate {
	line: number;
	input: string;
	/** The line of the entry that first declared this record, which is the one that was kept. */
	firstLine: number;
	name: string;
	type: DnsRecordType;
}

/** What one pasted zone file amounts to: the records to review, and the entries it rejected. */
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

/**
 * The reason a package rejection is reported under. A `$GENERATE` gets its own, since one
 * such line can stand for thousands of records the import does not have.
 */
function rejectionReason(rejection: ZoneFile.Rejection): ZoneFileRejectionReason {
	switch (rejection.reason) {
		case "include":
			return "includeDirective";
		case "unsupported-directive":
			return /^\s*\$GENERATE\b/i.test(rejection.input)
				? "generateDirective"
				: "unsupportedDirective";
		case "malformed":
		case "invalid-data":
		case "missing-owner":
			return "malformed";
	}
}

/**
 * Whether a record has a type the monitor tracks, which also guarantees it carries that
 * type's typed fields: every tracked type is one the codec reads into fields.
 */
function isTrackedRecord(record: ZoneFile.Record): record is ZoneFile.RecordFor<DnsRecordType> {
	return isDnsRecordType(record.type);
}

/** Shortens an entry for the report, so one pathological paste cannot bloat what is carried. */
function forReport(input: string): string {
	let value = input.trim();
	return value.length <= MAX_REPORTED_INPUT_LENGTH
		? value
		: value.slice(0, MAX_REPORTED_INPUT_LENGTH);
}

/**
 * Reads a pasted zone file into the tracked records it declares and the entries it rejects.
 * Every entry left out comes back in {@link ZoneFileImport.rejected} with a reason, in file
 * order, since an import that decides what gets monitored is the worst place for a silent omission.
 *
 * @param input - The raw contents of the paste box. It is read here and not retained.
 * @param domain - The monitor's domain: the initial origin, and the zone every owner must fall in.
 * @returns The declared records and the reported entries, or a failure when the paste is too large.
 * @example parseZoneFile("@\t1\tIN\tA\t192.0.2.1", "example.com") // 1 record at example.com
 */
export function parseZoneFile(
	input: string,
	domain: string,
): Result<ZoneFileImport, ZoneFileTooLargeError> {
	let zone = normalizeDnsName(domain);
	/**
	 * `origin-suffix` reads a dotless owner that already spells out the zone as absolute, since
	 * provider exports drop the apex's trailing dot and no real zone owns a name repeating itself.
	 */
	let parsed = parse(input, {
		origin: zone,
		relativeNames: "origin-suffix",
		maxBytes: MAX_ZONE_FILE_BYTES,
	});
	if (isFailure(parsed)) return failure(new ZoneFileTooLargeError(parsed.error.bytes));

	let lines = input.split(/\r?\n/);
	let records: ZoneFileRecord[] = [];
	let rejected: ZoneFileRejection[] = parsed.data.rejected.map((rejection) => ({
		line: rejection.line,
		input: forReport(rejection.input),
		reason: rejectionReason(rejection),
	}));
	let duplicates: ZoneFileDuplicate[] = [];
	/** Identities already declared, mapped to the line that declared them, so a repeat can point back. */
	let seen = new Map<string, number>();

	for (let record of parsed.data.records) {
		let entry = forReport(lines.slice(record.line - 1, record.endLine).join("\n"));

		if (record.class !== "IN") {
			rejected.push({ line: record.line, input: entry, reason: "nonInternetClass" });
			continue;
		}

		if (!isTrackedRecord(record)) {
			/** A known-but-untracked type is reported with its own reason, distinct from a typo. */
			let known = KNOWN_UNTRACKED_TYPES.has(record.type) || /^TYPE\d+$/.test(record.type);
			rejected.push({
				line: record.line,
				input: entry,
				reason: known ? "unsupportedType" : "malformed",
			});
			continue;
		}

		/** A zone file for one domain only enrols names inside that same domain. */
		if (record.name !== zone && !record.name.endsWith(`.${zone}`)) {
			rejected.push({ line: record.line, input: entry, reason: "outOfZone" });
			continue;
		}

		let { name, type } = record;
		let value = storedRecordValue(record);
		let identity = `${name} ${type} ${value}`;
		let firstLine = seen.get(identity);

		/**
		 * A repeat is recorded as a duplicate: identity is `(name, type, value)`, and DNS answers
		 * such an RRset once, so a second row would only restate a record that already exists.
		 */
		if (firstLine !== undefined) {
			duplicates.push({ line: record.line, input: entry, firstLine, name, type });
			continue;
		}

		seen.set(identity, record.line);
		records.push({ line: record.line, name, type, value });
	}

	rejected.sort((left, right) => left.line - right.line);

	return success({ records, rejected, duplicates });
}
