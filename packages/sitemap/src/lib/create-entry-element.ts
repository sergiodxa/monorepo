/**
 * Builds the XML element for one sitemap row. A `<urlset>` row carries every field
 * an entry holds; a `<sitemapindex>` row carries the two the protocol allows there,
 * so serializing an index drops the crawler metadata it has no element for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { XML } from "@sdxc/xml";

import type { Sitemap } from "../index.js";

/**
 * Builds the element for one row of a sitemap document.
 *
 * @param entry - One sitemap entry to serialize
 * @param kind - Which document the row belongs to
 * @returns The row element with its children in sitemap protocol order
 */
export function createEntryElement(entry: Sitemap.Entry, kind: Sitemap.Kind): XML.Element {
	let children: XML.Node[] = [{ name: "loc", children: [entry.loc.toString()] }];

	if (entry.updatedAt)
		children.push({ name: "lastmod", children: [entry.updatedAt.toISOString()] });

	if (kind === "index") return { name: "sitemap", children };

	if (entry.frequency) children.push({ name: "changefreq", children: [entry.frequency] });
	if (entry.priority !== undefined)
		children.push({ name: "priority", children: [`${entry.priority}`] });

	return { name: "url", children };
}
