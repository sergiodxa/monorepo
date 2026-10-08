/**
 * The types of a master file: the typed data of each record type, the record a zone file
 * declares with its position in the file, the entries it could not use, and the options
 * that steer reading and writing. The entry point exports them both top-level and as `ZoneFile`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The record types whose data is read into typed fields. */
export type TypedRecordType =
	| "A"
	| "AAAA"
	| "CNAME"
	| "NS"
	| "PTR"
	| "DNAME"
	| "MX"
	| "TXT"
	| "CAA"
	| "SRV"
	| "SOA";

/** A record type by mnemonic; the typed ones autocomplete, any other name is accepted. */
export type RecordType = TypedRecordType | (string & {});

/** A record class; `IN` is the internet, `CLASSnnn` spells one without a mnemonic. */
export type RecordClass = "IN" | "CH" | "HS" | "CS" | (string & {});

/** An IPv4 address, in dotted-quad form. */
export interface AData {
	type: "A";
	address: string;
}

/** An IPv6 address. */
export interface AAAAData {
	type: "AAAA";
	/** In RFC 5952 canonical form: lowercase, zero runs compressed. */
	address: string;
}

/** An alias: the owner resolves as `target` does. */
export interface CNAMEData {
	type: "CNAME";
	target: string;
}

/** A name server authoritative for the zone at the owner. */
export interface NSData {
	type: "NS";
	host: string;
}

/** A pointer to another name, the reading of a reverse-lookup (`in-addr.arpa`) owner. */
export interface PTRData {
	type: "PTR";
	target: string;
}

/** An alias for every name below the owner (RFC 6672), the owner itself excluded. */
export interface DNAMEData {
	type: "DNAME";
	target: string;
}

/** A mail exchanger; lower `preference` values are tried first. */
export interface MXData {
	type: "MX";
	preference: number;
	/** The mail host; `"."` is an RFC 7505 null MX, a domain that accepts no mail. */
	exchange: string;
}

/** Free text, such as SPF policies, DKIM keys and verification tokens. */
export interface TXTData {
	type: "TXT";
	/** The character-strings concatenated with nothing between them, as SPF and DKIM read it. */
	text: string;
	/** The character-strings as published, for the rare record whose boundaries matter. */
	strings: string[];
}

/** Which certificate authorities may issue for the name (RFC 8659). */
export interface CAAData {
	type: "CAA";
	/** The flags octet as published, reserved bits included, so the record prints back unchanged. */
	flags: number;
	/** Bit 128 of `flags`: a CA that does not understand `tag` must refuse to issue. */
	critical: boolean;
	/** Lowercased, since tags match case-insensitively. */
	tag: string;
	value: string;
}

/** Where a service runs; lower `priority` first, `weight` spreads load within one priority. */
export interface SRVData {
	type: "SRV";
	priority: number;
	weight: number;
	port: number;
	target: string;
}

/** The zone's start of authority, found at its apex and in negative answers. */
export interface SOAData {
	type: "SOA";
	primary: string;
	/** The responsible mailbox in DNS form: its first label is the local part. */
	mailbox: string;
	serial: number;
	refresh: number;
	retry: number;
	expire: number;
	/** Bounds how long a negative answer may be cached (RFC 2308). */
	minimum: number;
}

/** Data of a type without a typed reading, kept as written. */
export interface UnknownData {
	type: string;
	data: string;
}

/** A record's type-specific fields, what `parseRecordData` reads out of RDATA. */
export type RecordData<Type extends RecordType> = Type extends "A"
	? AData
	: Type extends "AAAA"
		? AAAAData
		: Type extends "CNAME"
			? CNAMEData
			: Type extends "NS"
				? NSData
				: Type extends "PTR"
					? PTRData
					: Type extends "DNAME"
						? DNAMEData
						: Type extends "MX"
							? MXData
							: Type extends "TXT"
								? TXTData
								: Type extends "CAA"
									? CAAData
									: Type extends "SRV"
										? SRVData
										: Type extends "SOA"
											? SOAData
											: UnknownData;

/** What every record read from a file carries beside its data. */
export interface RecordFields {
	/** Absolute, lowercased, no trailing dot; the root is `"."`. */
	name: string;
	/** Seconds; `null` when nothing in the file or the options stated one. */
	ttl: number | null;
	class: RecordClass;
	/** The included file the record came from; `null` for the text passed to `parse`. */
	file: string | null;
	/** 1-based line the entry starts on. */
	line: number;
	/** The line a parenthesized entry ends on; `line` for a one-line entry. */
	endLine: number;
	/** The `;` comment that ends the entry, trimmed; `null` without one. */
	comment: string | null;
}

/**
 * A record of an untyped type. Its data is kept as written, so relative names inside it
 * mean something only under the `origin` it was read with.
 */
export interface UntypedRecord extends UnknownData, RecordFields {
	origin: string;
}

/** The record a zone file declares for `Type`. */
export type RecordFor<Type extends RecordType> = Type extends TypedRecordType
	? RecordData<Type> & RecordFields
	: UntypedRecord;

/** Any record a zone file declares. */
export type Record =
	| { [Type in TypedRecordType]: RecordFor<Type> }[TypedRecordType]
	| UntypedRecord;

/** Why an entry did not become a record. */
export type RejectionReason =
	/** An unterminated quote, unbalanced parentheses, a bad name or TTL, a missing type or RDATA. */
	| "malformed"
	/** RDATA that does not fit its type's typed reading. */
	| "invalid-data"
	/** A blank owner with no earlier record to take it from. */
	| "missing-owner"
	/** `$INCLUDE` without an `include` option, a file it returned `null` for, or nesting past 8. */
	| "include"
	/** `$GENERATE`, or any other `$` word. */
	| "unsupported-directive";

/** An entry that did not become a record. */
export interface Rejection {
	file: string | null;
	line: number;
	endLine: number;
	/** The entry as written, every line of it. */
	input: string;
	reason: RejectionReason;
	/** The detail a log needs, such as the RDATA error. */
	message: string;
}

/** What a zone file amounts to: the records it declares and the entries it could not use. */
export interface Zone {
	/** The origin at the end of the file, after any `$ORIGIN`. */
	origin: string;
	records: Record[];
	rejected: Rejection[];
}

/** Options for `parse`. */
export interface ParseOptions {
	/** The initial `$ORIGIN`; `@` and relative names resolve against it until a `$ORIGIN` line changes it. */
	origin: string;
	/**
	 * The TTL a record gets when neither it, a `$TTL` nor an earlier record states one.
	 *
	 * @default null
	 */
	ttl?: number | null;
	/** The text of an `$INCLUDE`d file, `null` when it is unavailable; without it every `$INCLUDE` is rejected. */
	include?: (fileName: string, origin: string) => string | null;
	/**
	 * `"origin-suffix"` also reads a dotless name that equals the origin or ends in it as
	 * absolute, for exports that drop the trailing dot on fully-qualified names.
	 *
	 * @default "rfc1035"
	 */
	relativeNames?: "rfc1035" | "origin-suffix";
	/**
	 * The largest input in UTF-8 bytes, counted across included files.
	 *
	 * @default 1048576
	 */
	maxBytes?: number;
}

/** What a record to write needs beside its data; everything a parsed record has is accepted. */
export interface RecordInputFields {
	/** Absolute, with or without the trailing dot. */
	name: string;
	/** Left out of the line when `null`, absent, or equal to the zone's `ttl`. */
	ttl?: number | null;
	/** @default "IN" */
	class?: RecordClass;
	comment?: string | null;
}

/** A record to write: typed data, or untyped data with the origin its relative names need. */
export type RecordInput =
	| { [Type in TypedRecordType]: RecordData<Type> & RecordInputFields }[TypedRecordType]
	| (UnknownData & RecordInputFields & { origin?: string });

/** A zone to write; a `Zone` from `parse` is one. */
export interface ZoneInput {
	/** Written as `$ORIGIN`, and the name `relative` output is relative to. */
	origin?: string;
	/** Written as `$TTL`. */
	ttl?: number | null;
	records: readonly RecordInput[];
}

/** Options for `stringify`. */
export interface StringifyOptions {
	/**
	 * Writes names under the origin relative to it and the apex as `@`, the form people keep
	 * in git; every other name is written absolute.
	 *
	 * @default false
	 */
	relative?: boolean;
}
