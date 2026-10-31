/**
 * `/mcp` — the Model Context Protocol endpoint, and the page that explains it. A `POST`
 * is an agent speaking the protocol and a `GET` is a person who pasted the URL into a
 * browser, so both answer at the one address a client is configured with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyRequestContext } from "@sdxc/mcp/server";

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import mcp from "~/app/initializers/mcp";
import { readContent } from "~/app/services/content";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import SiteHeader from "~/resources/components/site-header";
import mcpSource from "~/resources/content/mcp.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary a search result and a link preview show. */
const DESCRIPTION =
	"Search and read the @sdxc package documentation over the Model Context Protocol: one stateless endpoint, every tool read-only, no credential.";

/**
 * Answers a `POST` as the protocol, with the router's own context in hand. Typed over any
 * request context, which is what the MCP server reads from.
 */
export function mcpEndpoint(ctx: AnyRequestContext): Promise<Response> {
	return mcp.fetch(ctx);
}

/** Renders the page a person reaches by opening the endpoint's URL. */
export default createAction(routes.mcp, async (ctx) => {
	let content = readContent(mcpSource);

	if (isFailure(content)) {
		ctx.log.fail(content.error, { line: content.error.position?.start.line ?? null });
		throw content.error;
	}

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="MCP endpoint — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
		>
			<SiteHeader activePath={routes.mcp.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, { components: LANDING_COMPONENTS })}
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
