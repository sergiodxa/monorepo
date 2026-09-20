/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	InvalidUUIDFormatError,
	InvalidUUIDLengthError,
	InvalidUUIDTypeError,
} from "./lib/errors.js";

import type { UUID as BaseUUID } from "node:crypto";

export type UUID = BaseUUID & { __brand: "UUID" };

export function isUUID(value: string): value is UUID {
	try {
		assertUUID(value);
		return true;
	} catch {
		return false;
	}
}

export function assertUUID(value: string): asserts value is UUID {
	if (typeof value !== "string") throw new InvalidUUIDTypeError(typeof value);
	if (value.length !== 36) throw new InvalidUUIDLengthError(value.length);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
		throw new InvalidUUIDFormatError(value);
	}
}

export function generateUUID(): UUID {
	let id = crypto.randomUUID();
	assertUUID(id);
	return id;
}

/**
 * Generates a UUID version 7: a 48-bit big-endian Unix millisecond timestamp
 * followed by 74 random bits, so values sort the way they were created without
 * a separate ordering column.
 *
 * @returns A UUIDv7, narrowed to {@link UUID}.
 * @example
 * let id = generateUUIDv7();
 * // "018f4d2e-...": sorts after a UUIDv7 minted a millisecond earlier
 */
export function generateUUIDv7(): UUID {
	let timestamp = BigInt(Date.now());
	let random = crypto.getRandomValues(new Uint8Array(10));

	let bytes = new Uint8Array(16);
	bytes[0] = Number((timestamp >> 40n) & 0xffn);
	bytes[1] = Number((timestamp >> 32n) & 0xffn);
	bytes[2] = Number((timestamp >> 24n) & 0xffn);
	bytes[3] = Number((timestamp >> 16n) & 0xffn);
	bytes[4] = Number((timestamp >> 8n) & 0xffn);
	bytes[5] = Number(timestamp & 0xffn);
	bytes[6] = 0x70 | (random[0]! & 0x0f);
	bytes[7] = random[1]!;
	bytes[8] = 0x80 | (random[2]! & 0x3f);
	bytes.set(random.subarray(3), 9);

	let hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	let id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	assertUUID(id);
	return id;
}

export { InvalidUUIDFormatError, InvalidUUIDLengthError, InvalidUUIDTypeError };
