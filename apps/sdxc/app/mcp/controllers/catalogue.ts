/**
 * The two catalogues' pages as MCP resources: each `@sdxc/u` utility, each `@sdxc/ui`
 * component (with the theme contract), and each `@sdxc/ui` subpath export under a
 * template of its own, so a person attaches the page for `padding`, `Dialog` or `hotkey`
 * by name and gets the same text its `.md` twin serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp";

import type { CataloguePage } from "~/app/services/catalogue-pages";

import resourceset from "~/app/mcp/resources";
import {
	listCataloguePages,
	readComponentMarkdown,
	readUiExportMarkdown,
	readUtilityMarkdown,
} from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/app/services/site";

/** Every page of one kind as the resource list entries a picker shows. */
async function listResources(kind: CataloguePage["kind"]) {
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

/** Serves every `@sdxc/u` utility as a resource a person can attach. */
export const utilityResource = createResource(resourceset.utility, {
	list: async () => await listResources("utility"),
	read: async (ctx) => await readUtilityMarkdown(ctx.variables.utility),
});

/** Serves the theme contract and every component as resources a person can attach. */
export const componentResource = createResource(resourceset.component, {
	list: async () => await listResources("component"),
	read: async (ctx) => await readComponentMarkdown(ctx.variables.component),
});

/** Serves every mixin, behavior class, animation and style recipe as a resource. */
export const uiExportResource = createResource(resourceset.uiExport, {
	list: async () => await listResources("export"),
	read: async (ctx) => await readUiExportMarkdown(ctx.variables.subpath, ctx.variables.slug),
});
