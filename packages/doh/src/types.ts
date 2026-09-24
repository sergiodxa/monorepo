/**
 * The types a DNS-over-HTTPS lookup reads and returns: the resolver it talks to, one
 * interface per typed record, and the answer that splits records of the asked type from
 * the CNAME chain that led to them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Groups the DNS-over-HTTPS types under a single import surface.
 */
export namespace DoH {
	/** A record type by mnemonic; the nine typed ones autocomplete, any other name is accepted. */
	export type RecordType =
		| "A"
		| "AAAA"
		| "CNAME"
		| "TXT"
		| "MX"
		| "NS"
		| "CAA"
		| "SOA"
		| "SRV"
		| (string & {});

	/**
	 * A DoH endpoint and the encoding it answers in. `format` leaves room for an RFC 8484
	 * `application/dns-message` resolver as a new value with no change to `resolve`.
	 */
	export interface Resolver {
		url: string;
		format: "json";
	}

	/** What every record carries. */
	export interface RecordBase {
		/** The owner name, lowercased and without the trailing dot. */
		name: string;
		/** Seconds the resolver allows the record to be cached. */
		ttl: number;
	}

	/** An IPv4 address, in dotted-quad form. */
	export interface ARecord extends RecordBase {
		type: "A";
		address: string;
	}

	/** An IPv6 address. */
	export interface AAAARecord extends RecordBase {
		type: "AAAA";
		/** In RFC 5952 canonical form: lowercase, zero runs compressed. */
		address: string;
	}

	/** An alias: `name` resolves as `target` does. */
	export interface CNAMERecord extends RecordBase {
		type: "CNAME";
		target: string;
	}

	/** A name server authoritative for the zone at `name`. */
	export interface NSRecord extends RecordBase {
		type: "NS";
		host: string;
	}

	/** A mail exchanger; lower `preference` values are tried first. */
	export interface MXRecord extends RecordBase {
		type: "MX";
		preference: number;
		/** The mail host; `"."` is an RFC 7505 null MX, a domain that accepts no mail. */
		exchange: string;
	}

	/** Free text, such as SPF policies, DKIM keys and verification tokens. */
	export interface TXTRecord extends RecordBase {
		type: "TXT";
		/** The character-strings concatenated with nothing between them, as SPF and DKIM read it. */
		text: string;
		/** The character-strings as published, for the rare record whose boundaries matter. */
		strings: string[];
	}

	/** Which certificate authorities may issue for the name (RFC 8659). */
	export interface CAARecord extends RecordBase {
		type: "CAA";
		/** The issuer-critical flag: a CA that does not understand `tag` must refuse to issue. */
		critical: boolean;
		tag: string;
		value: string;
	}

	/** Where a service runs; lower `priority` first, `weight` spreads load within one priority. */
	export interface SRVRecord extends RecordBase {
		type: "SRV";
		priority: number;
		weight: number;
		port: number;
		target: string;
	}

	/** The zone's start of authority, found at its apex and in negative answers. */
	export interface SOARecord extends RecordBase {
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

	/** A record of a type without a typed reading, or one whose data failed to parse, with its raw RDATA. */
	export interface UnknownRecord extends RecordBase {
		type: string;
		data: string;
	}

	/** The record a query for `Type` returns. */
	export type RecordFor<Type extends RecordType> = Type extends "A"
		? ARecord
		: Type extends "AAAA"
			? AAAARecord
			: Type extends "CNAME"
				? CNAMERecord
				: Type extends "TXT"
					? TXTRecord
					: Type extends "MX"
						? MXRecord
						: Type extends "NS"
							? NSRecord
							: Type extends "CAA"
								? CAARecord
								: Type extends "SOA"
									? SOARecord
									: Type extends "SRV"
										? SRVRecord
										: UnknownRecord;

	/** A record's type-specific fields, what `parseRecordData` reads out of RDATA. */
	export type RecordData<Type extends RecordType> = Omit<RecordFor<Type>, "name" | "ttl">;

	/** A successful (NOERROR) answer to one query. */
	export interface Answer<Type extends RecordType> {
		/** The queried name, lowercased and without the trailing dot. */
		name: string;
		type: Type;
		/** The records of the asked type; empty with an empty `unparsed` is NODATA. */
		records: RecordFor<Type>[];
		/** Records of the asked type whose data did not parse, kept with their raw RDATA. */
		unparsed: UnknownRecord[];
		/** The aliases followed before reaching `records`, in order. */
		chain: CNAMERecord[];
		/** The smallest TTL across `records` and `unparsed`, `null` when both are empty. */
		ttl: number | null;
		/** The AD flag: the resolver validated the answer with DNSSEC. */
		authenticated: boolean;
		/** The TC flag: the resolver's upstream answer was truncated. */
		truncated: boolean;
		durationMs: number;
	}

	/** Options for one lookup. */
	export interface ResolveOptions {
		/**
		 * @default CLOUDFLARE
		 */
		resolver?: Resolver;
		/** Sets `do=1`, asking for DNSSEC records alongside the answer. */
		dnssec?: boolean;
		/** Sets `cd=1`, asking the resolver to skip DNSSEC validation. */
		checkingDisabled?: boolean;
		signal?: AbortSignal;
		/**
		 * Milliseconds before the request is abandoned as a `TransportError`.
		 *
		 * @default 5000
		 */
		timeoutMs?: number;
	}
}
