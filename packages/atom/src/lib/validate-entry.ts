/**
 * Guards the three elements RFC 4287 §4.1.2 requires of every entry, so an
 * instance can never hold data that would serialize into an invalid document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Atom } from "../index.js";

import { AtomParseError } from "../index.js";

/**
 * Checks that an entry carries an id, a title and an updated timestamp. The title
 * may be empty, as RFC 4287 requires the element but not any text inside it.
 *
 * @param entry - The entry to check
 * @returns The entry, or an error naming the first required element that is missing
 */
export function validateEntry(entry: Atom.Entry): Result<Atom.Entry, AtomParseError> {
	if (!entry.id) return failure(new AtomParseError("Entry must include an id."));
	if (entry.title === undefined) return failure(new AtomParseError("Entry must include a title."));
	if (!entry.updated) {
		return failure(new AtomParseError("Entry must include an updated timestamp."));
	}
	return success(entry);
}
