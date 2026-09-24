/**
 * Reads the targets of an RFC 8288 `Link` header by relation. A hub announces itself and the
 * topic in this header on every delivery, and a subscriber reads it to tell which of its
 * subscriptions a delivery belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One `<target>; params` entry of a `Link` header. */
const ENTRY = /<([^>]*)>([^,<]*)/g;

/** One `; name=value` parameter of an entry, quoted or bare. */
const PARAMETER = /;\s*([^=;\s]+)\s*=\s*(?:"([^"]*)"|([^;,\s]+))/g;

/**
 * The first target a `Link` header declares under a relation, resolved against the address the
 * header arrived on; `null` when none does. An entry naming several relations (`rel="hub self"`)
 * counts for each of them.
 *
 * @param header - The header's value, or `null` when the message carried none.
 * @param rel - The relation to look for, compared case-insensitively.
 * @param base - The address relative targets resolve against.
 */
export function linkTarget(header: string | null, rel: string, base: string): string | null {
	if (header === null) return null;
	let wanted = rel.toLowerCase();

	for (let [, target = "", parameters = ""] of header.matchAll(ENTRY)) {
		for (let [, name = "", quoted, bare] of parameters.matchAll(PARAMETER)) {
			if (name.toLowerCase() !== "rel") continue;

			let rels = (quoted ?? bare ?? "").toLowerCase().split(/\s+/);
			if (!rels.includes(wanted)) break;

			try {
				return new URL(target, base).toString();
			} catch {
				break;
			}
		}
	}

	return null;
}
