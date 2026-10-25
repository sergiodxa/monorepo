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

import { canonicalIpv6, isIpv4, printIpv6 } from "./addresses.js";
import { decodeOctets, readCharacterStrings } from "./character-strings.js";
import { keyTag, readAlgorithm } from "./dnssec.js";
import { RecordDataError } from "./errors.js";
import { canonicalName, printLabels } from "./names.js";
import { decodeBase64, decodeHex, encodeBase64, encodeHex } from "./octets.js";
import { canonicalType } from "./record-types.js";
import { readSvcParams, readWireSvcParams } from "./svc-params.js";
import { readTtl } from "./ttl.js";

/** A parsed record body before it is narrowed to the caller's `RecordData<Type>`. */
interface ParsedData {
	type: string;
	[field: string]: unknown;
}

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

/**
 * The fields of DNSKEY data from its wire octets, the key tag computed over them, so the
 * presentation and generic spellings of one key agree on every field.
 */
function dnskeyFields(rdata: Uint8Array): Record<string, unknown> {
	let flags = ((rdata[0] ?? 0) << 8) | (rdata[1] ?? 0);
	return {
		flags,
		zoneKey: (flags & 0x0100) !== 0,
		secureEntryPoint: (flags & 0x0001) !== 0,
		protocol: rdata[2] ?? 0,
		algorithm: rdata[3] ?? 0,
		publicKey: encodeBase64(rdata.subarray(4)),
		keyTag: keyTag(rdata),
	};
}

/** Reads the leading `count` whitespace-separated fields and the rest of the text after them. */
function splitLeading(value: string, count: number): [string[], string] {
	let fields: string[] = [];
	let rest = value;
	for (let index = 0; index < count; index++) {
		let match = /^(\S+)\s*/.exec(rest);
		if (!match) break;
		fields.push(match[1] ?? "");
		rest = rest.slice(match[0].length);
	}
	return [fields, rest];
}

/** Reads presentation-format data for the typed record types. */
function parsePresentation(type: string, value: string): Result<ParsedData, RecordDataError> {
	let fields = value.split(/\s+/).filter((field) => field.length > 0);

	switch (type) {
		case "A":
			return isIpv4(value) ? success({ type, address: value }) : invalid(type, value);

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

		case "SVCB":
		case "HTTPS": {
			let [[priorityField, targetField], rest] = splitLeading(value, 2);
			let priority = readNumber(priorityField, 0xffff);
			let target = targetField === undefined ? null : canonicalName(targetField);
			let params = readSvcParams(rest);
			if (priority === null || target === null || params === null) return invalid(type, value);
			return success({ type, priority, target, params });
		}

		case "TLSA": {
			let [leading, rest] = splitLeading(value, 3);
			let [usage, selector, matchingType] = leading.map((field) => readNumber(field, 0xff));
			let association = decodeHex(rest);
			if (usage == null || selector == null || matchingType == null || !association)
				return invalid(type, value);
			let certificateAssociation = encodeHex(association);
			return success({ type, usage, selector, matchingType, certificateAssociation });
		}

		case "DS":
		case "CDS": {
			let [[tagField, algorithmField, digestTypeField], rest] = splitLeading(value, 3);
			let keyTag = readNumber(tagField, 0xffff);
			let algorithm = readAlgorithm(algorithmField);
			let digestType = readNumber(digestTypeField, 0xff);
			let digest = decodeHex(rest);
			if (keyTag === null || algorithm === null || digestType === null || !digest)
				return invalid(type, value);
			return success({ type, keyTag, algorithm, digestType, digest: encodeHex(digest) });
		}

		case "DNSKEY":
		case "CDNSKEY": {
			let [[flagsField, protocolField, algorithmField], rest] = splitLeading(value, 3);
			let flags = readNumber(flagsField, 0xffff);
			let protocol = readNumber(protocolField, 0xff);
			let algorithm = readAlgorithm(algorithmField);
			let key = decodeBase64(rest);
			if (flags === null || protocol === null || algorithm === null || !key)
				return invalid(type, value);
			let rdata = new Uint8Array(4 + key.length);
			rdata.set([flags >> 8, flags & 0xff, protocol, algorithm]);
			rdata.set(key, 4);
			return success({ type, ...dnskeyFields(rdata) });
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
				return bytes ? { address: printIpv6(bytes) } : null;
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
			case "SVCB":
			case "HTTPS": {
				let priority = this.#uint(2);
				let target = this.#name();
				let params = readWireSvcParams(this.#rest());
				if (priority === null || target === null || params === null) return null;
				return { priority, target, params };
			}
			case "TLSA": {
				let [usage, selector, matchingType] = [this.#uint(1), this.#uint(1), this.#uint(1)];
				let association = this.#rest();
				if (usage === null || selector === null || matchingType === null) return null;
				if (association.length === 0) return null;
				return { usage, selector, matchingType, certificateAssociation: encodeHex(association) };
			}
			case "DS":
			case "CDS": {
				let [keyTag, algorithm, digestType] = [this.#uint(2), this.#uint(1), this.#uint(1)];
				let digest = this.#rest();
				if (keyTag === null || algorithm === null || digestType === null) return null;
				if (digest.length === 0) return null;
				return { keyTag, algorithm, digestType, digest: encodeHex(digest) };
			}
			case "DNSKEY":
			case "CDNSKEY": {
				let rdata = this.#rest();
				return rdata.length > 4 ? dnskeyFields(rdata) : null;
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

	/** Every octet left, which the types ending in a variable-length field read as that field. */
	#rest(): Uint8Array {
		return this.#bytes(this.#octets.length - this.#offset) ?? new Uint8Array();
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
