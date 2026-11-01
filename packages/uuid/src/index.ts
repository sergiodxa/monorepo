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

/**
 * The version a UUID declares in its 13th hex digit, so a caller can tell a time-ordered v7
 * from a random v4 before reading any version-specific field.
 *
 * @param id - A validated UUID
 * @returns The version number, 0 to 15.
 * @example
 * getVersion(generateUUID()); // 7, from "@sdxc/uuid/v7"
 */
export function getVersion(id: UUID): number {
	return Number.parseInt(id[14]!, 16);
}

export { InvalidUUIDFormatError, InvalidUUIDLengthError, InvalidUUIDTypeError };
