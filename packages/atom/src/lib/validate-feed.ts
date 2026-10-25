/**
 * Guards the three elements RFC 4287 §4.1.1 requires of every feed, so an
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
 * Checks that a feed carries an id, a title and an updated timestamp. The title
 * may be empty, as RFC 4287 requires the element but not any text inside it.
 *
 * @param feed - The feed to check
 * @returns The feed, or an error naming the first required element that is missing
 */
export function validateFeed(feed: Atom.Feed): Result<Atom.Feed, AtomParseError> {
	if (!feed.id) return failure(new AtomParseError("Feed must include an id."));
	if (feed.title === undefined) return failure(new AtomParseError("Feed must include a title."));
	if (!feed.updated) return failure(new AtomParseError("Feed must include an updated timestamp."));
	return success(feed);
}
