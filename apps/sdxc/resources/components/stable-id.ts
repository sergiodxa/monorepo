/**
 * An element id derived from what the element holds. A documentation page is cached
 * against the bytes it rendered as, so an id that changes per render costs every
 * reader a fresh download of a page that did not change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** FNV-1a offset basis and prime, which give a short id with few collisions. */
const OFFSET_BASIS = 0x811c9dc5;
const PRIME = 0x01000193;

/**
 * The id an element carrying `value` answers to.
 *
 * @param prefix - What the element is, which keeps two kinds of id apart.
 * @param value - The content the id is derived from.
 * @returns An id that is the same on every render of the same content.
 * @example stableId("code", "npm add @sdxc/http") // "code-1a2b3c4d"
 */
export function stableId(prefix: string, value: string): string {
	let hash = OFFSET_BASIS;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, PRIME);
	}

	return `${prefix}-${(hash >>> 0).toString(36)}`;
}
