/**
 * Reads record data in presentation format, as a zone file or a DoH JSON answer writes it,
 * into typed fields per record type. RFC 3597 generic data (`\# len hex`) is decoded from
 * its wire form, which is how some resolvers answer types such as CAA.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type * as ZoneFile from "./types.js";

import { decodeOctets, readCharacterStrings } from "./character-strings.js";
import { RecordDataError } from "./errors.js";
import { canonicalName, printLabels } from "./names.js";
import { canonicalType } from "./record-types.js";
import { readTtl } from "./ttl.js";

/** A parsed record body before it is narrowed to the caller's `RecordData<Type>`. */
interface ParsedData {
	type: string;
	[field: string]: unknown;
}

/**
 * A dotted-quad IPv4 address without leading zeros, which `inet_aton` would read as octal
 * and browsers as decimal, so an address carrying them has no single meaning.
 */
const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * Reads a record's data into its typed fields; untyped types come back as `{ type, data }`.
 * Names come back canonical (lowercased, escapes resolved, no trailing dot, the root as
 * `"."`), and SOA timers accept BIND's TTL units (`2h`, `1w`) as zone files write them.
 *
 * @param type - The record type, as a mnemonic or RFC 3597 `TYPEnnn`.
 * @param data - The RDATA in presentation format.
 * @returns The record's fields, or why the data does not fit the type.
 * @template Type - The record type, which selects the fields returned.
 * @example parseRecordData("MX", "10 mx.example.com.") // success({ type: "MX", preference: 10, exchange: "mx.example.com" })
 */
export function parseRecordData<Type extends ZoneFile.RecordType>(
	type: Type,
	data: string,
): Result<ZoneFile.RecordData<Type>, RecordDataError> {
	let canonical = canonicalType(type);
	let value = data.trim();
	let parsed = value.startsWith("\\#")
		? parseGeneric(canonical, value)
		: parsePresentation(canonical, value);
	return parsed as Result<ZoneFile.RecordData<Type>, RecordDataError>;
}

/** Fails with the reason a record's data does not fit its type. */
function invalid(type: string, data: string): Result<never, RecordDataError> {
	return failure(new RecordDataError(`Invalid ${type} record data: ${JSON.stringify(data)}`));
}

/** Reads an unsigned decimal field no larger than `max`, or `null`. */
function readNumber(field: string | undefined, max: number): number | null {
	if (field === undefined || !/^\d+$/.test(field)) return null;
	let number = Number(field);
	return number <= max ? number : null;
}

/** An IPv6 literal in RFC 5952 canonical form, or `null` when the text is not one. */
function canonicalIpv6(value: string): string | null {
	if (!value.includes(":")) return null;
	let url = URL.parse(`http://[${value}]/`);
	return url ? url.hostname.slice(1, -1) : null;
}

/** Reads presentation-format data for the typed record types. */
function parsePresentation(type: string, value: string): Result<ParsedData, RecordDataError> {
	let fields = value.split(/\s+/).filter((field) => field.length > 0);

	switch (type) {
		case "A":
			return IPV4_PATTERN.test(value) ? success({ type, address: value }) : invalid(type, value);

		case "AAAA": {
			let address = canonicalIpv6(value);
			return address ? success({ type, address }) : invalid(type, value);
		}

		case "CNAME":
		case "NS":
		case "PTR":
		case "DNAME": {
			let name = fields.length === 1 && fields[0] !== undefined ? canonicalName(fields[0]) : null;
			if (name === null) return invalid(type, value);
			return success(type === "NS" ? { type, host: name } : { type, target: name });
		}

		case "MX": {
			let preference = readNumber(fields[0], 0xffff);
			let exchange = fields[1] === undefined ? null : canonicalName(fields[1]);
			if (fields.length !== 2 || preference === null || exchange === null)
				return invalid(type, value);
			return success({ type, preference, exchange });
		}

		case "TXT": {
			let strings = readCharacterStrings(value);
			if (isFailure(strings)) return strings;
			return success({ type, text: strings.data.join(""), strings: strings.data });
		}

		case "CAA": {
			let match = /^(\d+)\s+([A-Za-z0-9]+)\s+(\S.*)$/.exec(value);
			let flags = readNumber(match?.[1], 0xff);
			if (!match || flags === null || match[2] === undefined || match[3] === undefined)
				return invalid(type, value);
			let raw = match[3];
			let text = raw;
			if (raw.startsWith('"')) {
				let strings = readCharacterStrings(raw);
				if (isFailure(strings)) return strings;
				text = strings.data.join("");
			}
			return success({
				type,
				flags,
				critical: (flags & 0x80) !== 0,
				tag: match[2].toLowerCase(),
				value: text,
			});
		}

		case "SRV": {
			let [priority, weight, port] = fields.slice(0, 3).map((field) => readNumber(field, 0xffff));
			let target = fields[3] === undefined ? null : canonicalName(fields[3]);
			if (
				fields.length !== 4 ||
				priority == null ||
				weight == null ||
				port == null ||
				target === null
			)
				return invalid(type, value);
			return success({ type, priority, weight, port, target });
		}

		case "SOA": {
			let [primary, mailbox] = fields.slice(0, 2).map((field) => canonicalName(field));
			let numbers = fields
				.slice(2)
				.map(
					(field, index) => readNumber(field, 0xffffffff) ?? (index > 0 ? readTtl(field) : null),
				);
			if (
				fields.length !== 7 ||
				primary == null ||
				mailbox == null ||
				numbers.some((n) => n === null)
			) {
				return invalid(type, value);
			}
			let [serial, refresh, retry, expire, minimum] = numbers as number[];
			return success({
				type,
				primary,
				mailbox,
				serial,
				refresh,
				retry,
				expire,
				minimum,
			});
		}

		default:
			return success({ type, data: value });
	}
}

/**
 * Decodes RFC 3597 generic data (`\# <length> <hex>`) and reads the octets for the type. The
 * length is the whole leading digit run, so the hex after it starts at whitespace or a letter.
 */
function parseGeneric(type: string, value: string): Result<ParsedData, RecordDataError> {
	let match = /^\\#\s+(\d+)((?:[\sa-fA-F][\s0-9a-fA-F]*)?)$/.exec(value);
	if (!match) return invalid(type, value);

	let hex = (match[2] ?? "").replace(/\s+/g, "");
	let length = Number(match[1]);
	if (hex.length !== length * 2) return invalid(type, value);

	let octets = new Uint8Array(length);
	for (let index = 0; index < length; index++)
		octets[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);

	let fields = new WireReader(octets).record(type);
	if (fields === "unknown") return success({ type, data: value });
	return fields ? success({ type, ...fields }) : invalid(type, value);
}

/**
 * Reads the wire form of RDATA front to back. Every read returns `null` past the end, and a
 * record parses only when it consumes every octet, since trailing bytes mean a wrong type.
 */
class WireReader {
	#octets: Uint8Array;
	#offset = 0;

	/** @param octets - The RDATA octets. */
	constructor(octets: Uint8Array) {
		this.#octets = octets;
	}

	/**
	 * The typed fields for `type`, `null` when the octets do not fit it, or `"unknown"` for a
	 * type without a typed reading.
	 */
	record(type: string): Record<string, unknown> | null | "unknown" {
		let fields = this.#fields(type);
		if (fields === null || fields === "unknown") return fields;
		return this.#offset === this.#octets.length ? fields : null;
	}

	/** Reads the type's fields, leaving the offset after the last octet read. */
	#fields(type: string): Record<string, unknown> | null | "unknown" {
		switch (type) {
			case "A": {
				let bytes = this.#bytes(4);
				return bytes ? { address: Array.from(bytes).join(".") } : null;
			}
			case "AAAA": {
				let bytes = this.#bytes(16);
				if (!bytes) return null;
				let groups = Array.from({ length: 8 }, (_, index) =>
					(((bytes[index * 2] ?? 0) << 8) | (bytes[index * 2 + 1] ?? 0)).toString(16),
				);
				return { address: canonicalIpv6(groups.join(":")) ?? groups.join(":") };
			}
			case "CNAME":
			case "PTR":
			case "DNAME": {
				let target = this.#name();
				return target === null ? null : { target };
			}
			case "NS": {
				let host = this.#name();
				return host === null ? null : { host };
			}
			case "MX": {
				let preference = this.#uint(2);
				let exchange = this.#name();
				return preference === null || exchange === null ? null : { preference, exchange };
			}
			case "TXT": {
				let strings: string[] = [];
				while (this.#offset < this.#octets.length) {
					let length = this.#uint(1);
					let bytes = length === null ? null : this.#bytes(length);
					if (!bytes) return null;
					strings.push(decodeOctets(bytes));
				}
				return { text: strings.join(""), strings };
			}
			case "CAA": {
				let flags = this.#uint(1);
				let tagLength = this.#uint(1);
				let tag = tagLength === null ? null : this.#bytes(tagLength);
				if (flags === null || !tag || tag.length === 0) return null;
				let rest = this.#bytes(this.#octets.length - this.#offset) ?? new Uint8Array();
				return {
					flags,
					critical: (flags & 0x80) !== 0,
					tag: decodeOctets(tag).toLowerCase(),
					value: decodeOctets(rest),
				};
			}
			case "SRV": {
				let priority = this.#uint(2);
				let weight = this.#uint(2);
				let port = this.#uint(2);
				let target = this.#name();
				if (priority === null || weight === null || port === null || target === null) return null;
				return { priority, weight, port, target };
			}
			case "SOA": {
				let primary = this.#name();
				let mailbox = this.#name();
				let numbers = Array.from({ length: 5 }, () => this.#uint(4));
				if (primary === null || mailbox === null || numbers.some((n) => n === null)) return null;
				let [serial, refresh, retry, expire, minimum] = numbers;
				return { primary, mailbox, serial, refresh, retry, expire, minimum };
			}
			default:
				return "unknown";
		}
	}

	/** The next `length` octets, or `null` past the end. */
	#bytes(length: number): Uint8Array | null {
		if (this.#offset + length > this.#octets.length) return null;
		let bytes = this.#octets.subarray(this.#offset, this.#offset + length);
		this.#offset += length;
		return bytes;
	}

	/** A big-endian unsigned integer of `size` octets. */
	#uint(size: number): number | null {
		let bytes = this.#bytes(size);
		if (!bytes) return null;
		return bytes.reduce((total, byte) => total * 256 + byte, 0);
	}

	/**
	 * An uncompressed domain name, printed like presentation names. RFC 3597 forbids
	 * compression in generic data, so a compression pointer fails the read.
	 */
	#name(): string | null {
		let labels: Uint8Array[] = [];
		while (true) {
			let length = this.#uint(1);
			if (length === null || length > 63) return null;
			if (length === 0) break;
			let label = this.#bytes(length);
			if (!label) return null;
			labels.push(label);
		}
		return printLabels(labels);
	}
}
