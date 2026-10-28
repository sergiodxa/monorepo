/**
 * Serves every `@sdxc/u` utility as a resource a person can attach, written from the same
 * record its page draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "sdxc/mcp/server";

import { listCatalogueResources } from "~/app/mcp/catalogue";
import resourceset from "~/app/mcp/resources";
import { readUtilityMarkdown } from "~/app/services/catalogue-pages";

/** Lists every `@sdxc/u` utility; reads one as Markdown. */
export default createResource(resourceset.utility, {
	list: async () => await listCatalogueResources("utility"),
	read: async (ctx) => await readUtilityMarkdown(ctx.variables.utility),
});
