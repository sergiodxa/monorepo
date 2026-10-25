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
	| "SOA"
	| "SVCB"
	| "HTTPS"
	| "TLSA"
	| "DS"
	| "CDS"
	| "DNSKEY"
	| "CDNSKEY";

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

/**
 * The parameters of an SVCB or HTTPS record (RFC 9460), one optional field per key. A key
 * that is absent was not published; `true` marks a key published without a value.
 */
export interface SvcParams {
	/** Keys a client must understand to use the record, by presentation name (`alpn`, `key65000`). */
	mandatory?: string[];
	/** Protocol ids (`h2`, `h3`) in the publisher's order of preference. */
	alpn?: string[];
	/** The default ALPN (`http/1.1` for HTTPS) is unsupported; only `alpn` applies. */
	noDefaultAlpn?: true;
	port?: number;
	/** IPv4 addresses a client may use before the target's A records resolve. */
	ipv4Hint?: string[];
	/** The ECHConfigList, base64-encoded as the presentation format writes it. */
	ech?: string;
	/** IPv6 addresses in RFC 5952 canonical form, as hints like `ipv4Hint`. */
	ipv6Hint?: string[];
	/** The DoH URI template's path (RFC 9461), relative to the target. */
	dohPath?: string;
	/** The service accepts Oblivious HTTP requests (RFC 9540). */
	ohttp?: true;
	/** Keys without a reading here, by key number, each value's octets read as UTF-8. */
	other?: { [key: number]: string };
}

/** A service binding (RFC 9460): where and how to reach the service at the owner. */
export interface SVCBData {
	type: "SVCB";
	/** `0` is AliasMode, which only names `target`; any other value orders ServiceMode records, lowest first. */
	priority: number;
	/** The service's host; `"."` means the owner itself in ServiceMode and no service in AliasMode. */
	target: string;
	params: SvcParams;
}

/** The SVCB record for HTTPS origins (RFC 9460), published at the origin's own name. */
export interface HTTPSData extends Omit<SVCBData, "type"> {
	type: "HTTPS";
}

/** Binds a TLS certificate or public key to a service, DANE (RFC 6698, RFC 7671). */
export interface TLSAData {
	type: "TLSA";
	/** `0` PKIX-TA, `1` PKIX-EE, `2` DANE-TA, `3` DANE-EE. */
	usage: number;
	/** `0` matches the whole certificate, `1` its SubjectPublicKeyInfo. */
	selector: number;
	/** `0` the exact bytes, `1` their SHA-256, `2` their SHA-512. */
	matchingType: number;
	/** Lowercase hex. */
	certificateAssociation: string;
}

/** A digest of the child zone's key-signing key, published in the parent (RFC 4034). */
export interface DSData {
	type: "DS";
	/** The key tag of the DNSKEY the digest is of, for picking it out of the child's key set. */
	keyTag: number;
	/** The DNSSEC algorithm number; `13` is ECDSA P-256 with SHA-256. */
	algorithm: number;
	/** `1` SHA-1, `2` SHA-256, `4` SHA-384. */
	digestType: number;
	/** Lowercase hex. */
	digest: string;
}

/** The child's DS record as it asks the parent to publish it (RFC 7344); `0 0 0 00` asks for removal. */
export interface CDSData extends Omit<DSData, "type"> {
	type: "CDS";
}

/** A zone's public signing key (RFC 4034). */
export interface DNSKEYData {
	type: "DNSKEY";
	/** The flags as published, so the record prints back unchanged. */
	flags: number;
	/** Bit 7 of `flags`: the key signs the zone's records; DNSSEC ignores a key without it. */
	zoneKey: boolean;
	/** Bit 15 of `flags`: the key is a key-signing key, the one a DS record points at. */
	secureEntryPoint: boolean;
	/** Always `3` in a valid key. */
	protocol: number;
	algorithm: number;
	/** Base64, as the presentation format writes it. */
	publicKey: string;
	/** The RFC 4034 Appendix B tag a DS or RRSIG names this key by. */
	keyTag: number;
}

/** The child's DNSKEY as it asks the parent to derive a DS from it (RFC 7344). */
export interface CDNSKEYData extends Omit<DNSKEYData, "type"> {
	type: "CDNSKEY";
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
											: Type extends "SVCB"
												? SVCBData
												: Type extends "HTTPS"
													? HTTPSData
													: Type extends "TLSA"
														? TLSAData
														: Type extends "DS"
															? DSData
															: Type extends "CDS"
																? CDSData
																: Type extends "DNSKEY"
																	? DNSKEYData
																	: Type extends "CDNSKEY"
																		? CDNSKEYData
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
