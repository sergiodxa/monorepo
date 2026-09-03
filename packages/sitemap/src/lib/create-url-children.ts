/**
 * Builds ordered XML child nodes for a single sitemap `<url>` entry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { XML } from "@sdxc/xml";

import type { Sitemap } from "../index";

/**
 * Builds the ordered child nodes for one sitemap `<url>` element.
 *
 * @param url - One sitemap entry to serialize
 * @returns Child elements in sitemap protocol order
 */
export function createURLChildren(url: Sitemap.Entry): XML.Node[] {
	let nodes: XML.Node[] = [{ name: "loc", children: [url.loc.toString()] }];

	if (url.updatedAt) nodes.push({ name: "lastmod", children: [url.updatedAt.toISOString()] });
	if (url.frequency) nodes.push({ name: "changefreq", children: [url.frequency] });
	if (url.priority !== undefined) nodes.push({ name: "priority", children: [`${url.priority}`] });

	return nodes;
}
