/**
 * The resource list entries for the `@sdxc/u` and `@sdxc/ui` catalogue pages, shared by the
 * three catalogue resources so each picker addresses a page by its markdown twin and names
 * an export by its section, the way its page is filed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CataloguePage } from "~/app/services/catalogue-pages";

import { listCataloguePages } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/site";

/**
 * Every catalogue page of one kind as the entries a resource picker shows.
 *
 * @param kind Which catalogue's pages to list.
 */
export async function listCatalogueResources(kind: CataloguePage["kind"]) {
	let pages = await listCataloguePages();

	return pages
		.filter((page) => page.kind === kind)
		.map((page) => ({
			uri: absoluteUrl(page.markdownHref),
			name: kind === "export" ? `${page.section.toLowerCase()}/${page.title}` : page.title,
			title: page.title,
			description: page.summary,
		}));
}
