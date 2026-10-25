/**
 * The SvcParams codec SVCB and HTTPS share (RFC 9460): presentation `key=value` lists and
 * their wire form both read into one wire-keyed map first, so the two spellings validate
 * by the same rules and come out as the same `SvcParams`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";

import type * as ZoneFile from "./types.js";

import { ipv4Octets, ipv6Octets, printIpv6 } from "./addresses.js";
import { decodeOctets, readCharacterStrings } from "./character-strings.js";
import { decodeBase64, encodeBase64 } from "./octets.js";

/** The registered SvcParamKeys by number; any other key is spelled `keyNNNNN`. */
const KEY_NAMES: Record<number, string> = {
	0: "mandatory",
	1: "alpn",
	2: "no-default-alpn",
	3: "port",
	4: "ipv4hint",
	5: "ech",
	6: "ipv6hint",
	7: "dohpath",
	8: "ohttp",
};

/** The number of each registered key name. */
const KEY_NUMBERS = new Map(
	Object.entries(KEY_NAMES).map(([number, name]) => [name, Number(number)]),
);

/** Encodes the text of a value into the octets it is on the wire. */
const ENCODER = new TextEncoder();

/** The presentation name of a key number. */
function keyName(key: number): string {
	return KEY_NAMES[key] ?? `key${key}`;
}

/** The number of a key name, registered or `keyNNNNN`; `null` for anything else and for the reserved 65535. */
function keyNumber(name: string): number | null {
	let generic = /^key(0|[1-9]\d{0,4})$/.exec(name);
	let number = generic ? Number(generic[1]) : (KEY_NUMBERS.get(name) ?? null);
	return number !== null && number < 0xffff ? number : null;
}

/**
 * Splits presentation params into `key[=value]` fields on whitespace outside quotes,
 * stepping over escaped characters so `\"` and `\ ` stay inside their field.
 */
function splitFields(text: string): string[] {
	let fields: string[] = [];
	let field = "";
	let quoted = false;
	for (let index = 0; index < text.length; index++) {
		let char = text[index] ?? "";
		if (char === "\\") {
			field += text.slice(index, index + 2);
			index += 1;
		} else if (char === '"') {
			quoted = !quoted;
			field += char;
		} else if (!quoted && /\s/.test(char)) {
			if (field.length > 0) fields.push(field);
			field = "";
		} else {
			field += char;
		}
	}
	if (field.length > 0) fields.push(field);
	return fields;
}

/** A value's text with its quoting and escapes removed, `key=` as empty; `null` for more than one character-string. */
function readValue(raw: string): string | null {
	if (raw.length === 0) return "";
	let strings = readCharacterStrings(raw);
	if (isFailure(strings) || strings.data.length !== 1) return null;
	return strings.data[0] ?? null;
}

/**
 * Splits a value-list (RFC 9460 Appendix A.1) on its unescaped commas, `\,` and `\\`
 * standing for a literal comma and backslash; `null` when any item is empty.
 */
function splitValueList(value: string): string[] | null {
	let items: string[] = [];
	let item = "";
	for (let index = 0; index < value.length; index++) {
		let char = value[index] ?? "";
		if (char === "\\" && index + 1 < value.length) {
			item += value[index + 1];
			index += 1;
		} else if (char === ",") {
			items.push(item);
			item = "";
		} else {
			item += char;
		}
	}
	items.push(item);
	return items.every((entry) => entry.length > 0) ? items : null;
}

/** Joins octet runs into one. */
function concat(parts: Uint8Array[]): Uint8Array {
	let octets = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (let part of parts) {
		octets.set(part, offset);
		offset += part.length;
	}
	return octets;
}

/** A 16-bit big-endian integer's two octets. */
function uint16(value: number): Uint8Array {
	return Uint8Array.of(value >> 8, value & 0xff);
}

/** Reads every item of a value-list through `read`, `null` when the list or any item is invalid. */
function encodeList(value: string, read: (item: string) => Uint8Array | null): Uint8Array | null {
	let items = splitValueList(value);
	if (!items) return null;
	let parts = items.map(read);
	return parts.every((part) => part !== null) ? concat(parts as Uint8Array[]) : null;
}

/** The wire octets of one key's presentation value; `value` is `null` when the field has no `=`. */
function encodeValue(key: number, value: string | null): Uint8Array | null {
	switch (key) {
		case 0: {
			if (value === null) return null;
			let items = splitValueList(value);
			let keys = items?.map(keyNumber);
			if (!keys || keys.some((number) => number === null)) return null;
			return concat((keys as number[]).sort((a, b) => a - b).map(uint16));
		}
		case 1:
			return value === null
				? null
				: encodeList(value, (item) => {
						let octets = ENCODER.encode(item);
						return octets.length <= 0xff ? concat([Uint8Array.of(octets.length), octets]) : null;
					});
		case 2:
		case 8:
			return value === null || value === "" ? new Uint8Array() : null;
		case 3:
			return value !== null && /^\d{1,5}$/.test(value) && Number(value) <= 0xffff
				? uint16(Number(value))
				: null;
		case 4:
			return value === null ? null : encodeList(value, ipv4Octets);
		case 5:
			return value === null ? null : decodeBase64(value);
		case 6:
			return value === null ? null : encodeList(value, ipv6Octets);
		default:
			return ENCODER.encode(value ?? "");
	}
}

/**
 * Reads the params of SVCB or HTTPS presentation data, the fields after the target.
 * Fails on an unknown or repeated key and on a value its key does not accept.
 *
 * @param text - Zero or more `key[=value]` fields.
 */
export function readSvcParams(text: string): ZoneFile.SvcParams | null {
	let values = new Map<number, Uint8Array>();
	for (let field of splitFields(text)) {
		let separator = field.indexOf("=");
		let key = keyNumber(separator === -1 ? field : field.slice(0, separator));
		if (key === null || values.has(key)) return null;
		let value = separator === -1 ? null : readValue(field.slice(separator + 1));
		if (separator !== -1 && value === null) return null;
		let octets = encodeValue(key, value);
		if (!octets) return null;
		values.set(key, octets);
	}
	return decodeSvcParams(new Map([...values].sort(([a], [b]) => a - b)));
}

/**
 * Reads the params of SVCB or HTTPS wire data, the octets after the target. Keys must
 * strictly increase, as RFC 9460 requires of the wire form.
 *
 * @param octets - The SvcParams octets, `key length value` repeated.
 */
export function readWireSvcParams(octets: Uint8Array): ZoneFile.SvcParams | null {
	let values = new Map<number, Uint8Array>();
	let offset = 0;
	let previous = -1;
	while (offset < octets.length) {
		if (offset + 4 > octets.length) return null;
		let key = ((octets[offset] ?? 0) << 8) | (octets[offset + 1] ?? 0);
		let length = ((octets[offset + 2] ?? 0) << 8) | (octets[offset + 3] ?? 0);
		offset += 4;
		if (key <= previous || key === 0xffff || offset + length > octets.length) return null;
		values.set(key, octets.subarray(offset, offset + length));
		offset += length;
		previous = key;
	}
	return decodeSvcParams(values);
}

/** Splits octets into runs of `size`, `null` when they do not divide evenly or are empty. */
function chunks(octets: Uint8Array, size: number): Uint8Array[] | null {
	if (octets.length === 0 || octets.length % size !== 0) return null;
	return Array.from({ length: octets.length / size }, (_, index) =>
		octets.subarray(index * size, index * size + size),
	);
}

/** Reads length-prefixed ALPN ids, `null` when one is empty or overruns the value. */
function readAlpn(octets: Uint8Array): string[] | null {
	let ids: string[] = [];
	let offset = 0;
	while (offset < octets.length) {
		let length = octets[offset] ?? 0;
		if (length === 0 || offset + 1 + length > octets.length) return null;
		ids.push(decodeOctets(octets.subarray(offset + 1, offset + 1 + length)));
		offset += 1 + length;
	}
	return ids.length > 0 ? ids : null;
}

/**
 * Turns wire values into `SvcParams`, enforcing what RFC 9460 asks of every key: values of
 * the right shape, and a `mandatory` list of distinct keys that are all present and exclude
 * `mandatory` itself.
 */
function decodeSvcParams(values: Map<number, Uint8Array>): ZoneFile.SvcParams | null {
	let params: ZoneFile.SvcParams = {};
	for (let [key, value] of values) {
		switch (key) {
			case 0: {
				let keys = chunks(value, 2)?.map((pair) => ((pair[0] ?? 0) << 8) | (pair[1] ?? 0));
				if (!keys) return null;
				let increasing = keys.every(
					(number, index) => index === 0 || number > (keys[index - 1] ?? 0),
				);
				if (!increasing || keys.some((number) => number === 0 || !values.has(number))) return null;
				params.mandatory = keys.map(keyName);
				break;
			}
			case 1: {
				let alpn = readAlpn(value);
				if (!alpn) return null;
				params.alpn = alpn;
				break;
			}
			case 2:
			case 8:
				if (value.length !== 0) return null;
				if (key === 2) params.noDefaultAlpn = true;
				else params.ohttp = true;
				break;
			case 3:
				if (value.length !== 2) return null;
				params.port = ((value[0] ?? 0) << 8) | (value[1] ?? 0);
				break;
			case 4: {
				let addresses = chunks(value, 4);
				if (!addresses) return null;
				params.ipv4Hint = addresses.map((address) => Array.from(address).join("."));
				break;
			}
			case 5:
				if (value.length === 0) return null;
				params.ech = encodeBase64(value);
				break;
			case 6: {
				let addresses = chunks(value, 16);
				if (!addresses) return null;
				params.ipv6Hint = addresses.map(printIpv6);
				break;
			}
			case 7:
				if (value.length === 0) return null;
				params.dohPath = decodeOctets(value);
				break;
			default:
				params.other = { ...params.other, [key]: decodeOctets(value) };
		}
	}
	return params;
}

/** Escapes a value-list item so its commas and backslashes read back as part of it. */
function escapeItem(item: string): string {
	return item.replace(/[\\,]/g, "\\$&");
}

/**
 * Prints params in canonical presentation form, keys in ascending number order and values
 * quoted wherever they are free text, so two spellings of one record print alike.
 *
 * @param params - The params to print.
 * @param quote - Prints a character-string with its escapes.
 * @returns The fields joined by spaces; empty for no params.
 */
export function printSvcParams(
	params: ZoneFile.SvcParams,
	quote: (text: string) => string,
): string {
	let fields: [number, string][] = [];
	if (params.mandatory) {
		let keys = params.mandatory.map((name) => [keyNumber(name) ?? 0xffff, name] as const);
		let sorted = keys.sort(([a], [b]) => a - b).map(([, name]) => name);
		fields.push([0, `mandatory=${sorted.join(",")}`]);
	}
	if (params.alpn) fields.push([1, `alpn=${quote(params.alpn.map(escapeItem).join(","))}`]);
	if (params.noDefaultAlpn) fields.push([2, "no-default-alpn"]);
	if (params.port !== undefined) fields.push([3, `port=${params.port}`]);
	if (params.ipv4Hint) fields.push([4, `ipv4hint=${params.ipv4Hint.join(",")}`]);
	if (params.ech !== undefined) fields.push([5, `ech=${params.ech}`]);
	if (params.ipv6Hint) fields.push([6, `ipv6hint=${params.ipv6Hint.join(",")}`]);
	if (params.dohPath !== undefined) fields.push([7, `dohpath=${quote(params.dohPath)}`]);
	if (params.ohttp) fields.push([8, "ohttp"]);
	for (let [key, value] of Object.entries(params.other ?? {}))
		fields.push([Number(key), `key${key}=${quote(value)}`]);
	return fields
		.sort(([a], [b]) => a - b)
		.map(([, field]) => field)
		.join(" ");
}
