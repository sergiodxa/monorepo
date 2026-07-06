/**
 * UUID utilities for the blog app. Defines a branded UUID type and provides
 * generateUUID (a tagged wrapper over crypto.randomUUID) plus assertUUID, a
 * runtime assertion that narrows unknown values to the UUID type. This keeps IDs
 * type-safe and validated across the models and database layers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Tagged } from "type-fest";

import { z } from "zod";

export type UUID = Tagged<string, "__uuid">;

export function generateUUID() {
	return crypto.randomUUID() as UUID;
}

export function assertUUID(value: unknown): asserts value is UUID {
	if (!z.string().uuid().safeParse(value).success) {
		throw new TypeError("Invalid UUID");
	}
}
