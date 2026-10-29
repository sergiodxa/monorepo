/**
 * Serves the `@sdxc/ui` theme contract and every component as resources a person can attach,
 * written from the same record each page draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import { listCatalogueResources } from "~/app/mcp/catalogue";
import resourceset from "~/app/mcp/resources";
import { readComponentMarkdown } from "~/app/services/catalogue-pages";

/** Lists the theme contract and every component; reads one as Markdown. */
export default createResource(resourceset.component, {
	list: async () => await listCatalogueResources("component"),
	read: async (ctx) => await readComponentMarkdown(ctx.variables.component),
});
