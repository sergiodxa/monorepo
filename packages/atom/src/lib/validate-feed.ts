/**
 * Guards the three elements RFC 4287 §4.1.1 requires of every feed, so an
 * instance can never hold data that would serialize into an invalid document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Atom } from "../index.js";

import { AtomParseError } from "../index.js";

import { readTextValue } from "./validate-entry.js";

/**
 * Checks that a feed carries an id, a title and an updated timestamp.
 *
 * @param feed - The feed to check
 * @throws AtomParseError Naming the first required element that is missing
 */
export function validateFeed(feed: Atom.Feed): void {
	if (!feed.id) throw new AtomParseError("Feed must include an id.");
	if (!readTextValue(feed.title)) throw new AtomParseError("Feed must include a title.");
	if (!feed.updated) throw new AtomParseError("Feed must include an updated timestamp.");
}
