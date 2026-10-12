/**
 * Scanner for references to `crypto.randomUUID`. `@sdxc/uuid/v4` is the one module that
 * calls it, so every identifier carries the branded `UUID` type and every secret comes from
 * `@sdxc/crypto`'s `randomToken` with the full entropy a token needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A `randomUUID` reference, located for the failure message. */
export interface RandomUUIDReference {
	line: number;
	text: string;
}

/**
 * Matches the API by name, so a property access, a destructured binding, a spy and a
 * documentation example all count.
 */
const RANDOM_UUID = /\brandomUUID\b/;

/** Files allowed to name the API: the v4 generator itself and the README that documents it. */
export const ALLOWED_FILES = new Set(["packages/uuid/src/v4.ts", "packages/uuid/README.md"]);

/**
 * Every line of `source` that names `randomUUID`, comments and prose included.
 *
 * @param source File contents.
 * @returns One entry per offending line, numbered from 1.
 */
export function findRandomUUIDReferences(source: string): RandomUUIDReference[] {
	let found: RandomUUIDReference[] = [];
	let lines = source.split("\n");

	for (let index = 0; index < lines.length; index++) {
		let text = lines[index]!;
		if (RANDOM_UUID.test(text)) found.push({ line: index + 1, text: text.trim() });
	}

	return found;
}
