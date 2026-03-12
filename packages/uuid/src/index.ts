import type { UUID as BaseUUID } from "node:crypto";

export type UUID = BaseUUID & { __brand: "UUID" };

export function isUUID(value: string): value is UUID {
	let uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	return uuidRegex.test(value);
}

export function assertUUID(value: string): asserts value is UUID {
	if (isUUID(value)) return;
	throw new TypeError(`Invalid UUID: ${value}`);
}

export function generateUUID(): UUID {
	let id = crypto.randomUUID();
	assertUUID(id);
	return id;
}
