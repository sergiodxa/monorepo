/**
 * Serves every `@sdxc/ui` mixin, behavior class, animation and style recipe as a resource a
 * person can attach, written from the same record its page draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "sdxc/mcp/server";

import { listCatalogueResources } from "~/app/mcp/catalogue";
import resourceset from "~/app/mcp/resources";
import { readUiExportMarkdown } from "~/app/services/catalogue-pages";

/** Lists every mixin, behavior class, animation and style recipe; reads one as Markdown. */
export default createResource(resourceset.uiExport, {
	list: async () => await listCatalogueResources("export"),
	read: async (ctx) => await readUiExportMarkdown(ctx.variables.subpath, ctx.variables.slug),
});
