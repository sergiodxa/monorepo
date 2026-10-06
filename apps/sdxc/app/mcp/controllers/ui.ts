/**
 * The `@sdxc/ui` reference pages as MCP resources: each component and the theme
 * contract under one template, each subpath export under another, so a person attaches
 * the page for `Dialog` or `hotkey` by name and gets the same text its `.md` twin serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp";

import resourceset from "~/app/mcp/resources";
import { absoluteUrl } from "~/app/services/site";
import { listUiPages, readComponentMarkdown, readUiExportMarkdown } from "~/app/services/ui-pages";

/** Serves the theme contract and every component as resources a person can attach. */
export const componentResource = createResource(resourceset.component, {
	list: async () =>
		(await listUiPages())
			.filter((page) => page.subpath === null)
			.map((page) => ({
				uri: absoluteUrl(page.markdownHref),
				name: page.title,
				title: page.title,
				description: page.summary,
			})),

	read: async (ctx) => await readComponentMarkdown(ctx.variables.component),
});

/** Serves every mixin, behavior class, animation and style recipe as a resource. */
export const uiExportResource = createResource(resourceset.uiExport, {
	list: async () =>
		(await listUiPages())
			.filter((page) => page.subpath !== null)
			.map((page) => ({
				uri: absoluteUrl(page.markdownHref),
				name: `${page.subpath}/${page.title}`,
				title: page.title,
				description: page.summary,
			})),

	read: async (ctx) => await readUiExportMarkdown(ctx.variables.subpath, ctx.variables.slug),
});
