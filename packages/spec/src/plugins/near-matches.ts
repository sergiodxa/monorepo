/**
 * The near-match half of a failed lookup's diagnosis, read off the parsed document
 * that `html` and `browser` both answer from, so a miss reads the same in either
 * namespace: other names under the role, other roles under the name, and role-less controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HTML } from "@sdxc/html";

import type { ElementQuery, NearMatches } from "./addressing.js";

/**
 * What the document held near a lookup that matched nothing. Generic elements are
 * left out, since a wrapper inherits the name of what it wraps, and a role-less
 * control counts only when a `name` attribute gives `field` something to reach it by.
 *
 * @param doc - The document the lookup ran against.
 * @param query - The lookup that matched nothing.
 * @param available - The names the same role carries, as the lookup's own miss listed them.
 * @returns The near matches to report.
 */
export function nearMatches(
	doc: HTML,
	query: ElementQuery,
	available: readonly string[],
): NearMatches {
	if (query.kind !== "role" || query.name === undefined) return { names: available };

	let roles = new Set<string>();
	let fields = new Set<string>();
	for (let found of doc.queryAll({ name: query.name })) {
		if (found.role === query.role || found.role === "generic") continue;
		if (found.role !== undefined) {
			roles.add(found.role);
			continue;
		}
		let field = found.attributes["name"];
		if (field !== undefined && field !== "") fields.add(field);
	}

	return { names: available, roles: [...roles], fields: [...fields] };
}
