/**
 * The types a DNS-over-HTTPS lookup reads and returns: the resolver it talks to, one
 * interface per typed record, and the answer that splits records of the asked type from
 * the CNAME chain that led to them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ZoneFile } from "@sdxc/zone-file";

/**
 * Groups the DNS-over-HTTPS types under a single import surface.
 */
export namespace DoH {
	/** A record type by mnemonic; the typed ones autocomplete, any other name is accepted. */
	export type RecordType = ZoneFile.RecordType;

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

	/** The record a query for `Type` returns: its typed data, owner and TTL. */
	export type RecordFor<Type extends RecordType> = ZoneFile.RecordData<Type> & RecordBase;

	/** An IPv4 address. */
	export type ARecord = RecordFor<"A">;

	/** An IPv6 address, in RFC 5952 canonical form. */
	export type AAAARecord = RecordFor<"AAAA">;

	/** An alias: `name` resolves as `target` does. */
	export type CNAMERecord = RecordFor<"CNAME">;

	/** A name server authoritative for the zone at `name`. */
	export type NSRecord = RecordFor<"NS">;

	/** A pointer to another name, the answer to a reverse lookup. */
	export type PTRRecord = RecordFor<"PTR">;

	/** An alias for every name below `name`. */
	export type DNAMERecord = RecordFor<"DNAME">;

	/** A mail exchanger; lower `preference` values are tried first. */
	export type MXRecord = RecordFor<"MX">;

	/** Free text, such as SPF policies, DKIM keys and verification tokens. */
	export type TXTRecord = RecordFor<"TXT">;

	/** Which certificate authorities may issue for the name (RFC 8659). */
	export type CAARecord = RecordFor<"CAA">;

	/** Where a service runs. */
	export type SRVRecord = RecordFor<"SRV">;

	/** The zone's start of authority, found at its apex and in negative answers. */
	export type SOARecord = RecordFor<"SOA">;

	/** A record of a type without a typed reading, or one whose data failed to parse, with its raw RDATA. */
	export type UnknownRecord = ZoneFile.UnknownData & RecordBase;

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
