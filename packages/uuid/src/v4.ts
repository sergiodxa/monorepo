/**
 * Random UUID generation: version 4 values from the platform's `crypto.randomUUID()`,
 * narrowed to the branded `UUID` type. Every free bit is random, so a value reveals nothing,
 * including when it was created.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UUID } from "./index.js";

import { assertUUID } from "./index.js";

/**
 * Generates a version 4 UUID: 122 random bits, so values carry no ordering and expose no
 * creation time.
 *
 * @returns A UUIDv4, narrowed to {@link UUID}.
 * @example
 * let id = generateUUID();
 * // "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 */
export function generateUUID(): UUID {
	let id = crypto.randomUUID();
	assertUUID(id);
	return id;
}
