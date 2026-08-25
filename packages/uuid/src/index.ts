/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { InvalidUUIDFormatError, InvalidUUIDLengthError, InvalidUUIDTypeError } from "./lib/errors";

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

export { InvalidUUIDFormatError, InvalidUUIDLengthError, InvalidUUIDTypeError };
