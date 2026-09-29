/**
 * `/mcp` — the Model Context Protocol endpoint, and the page that explains it.
 *
 * A `POST` is an agent speaking the protocol and a `GET` is a person who pasted the URL
 * into a browser, so both answer at the one address a client is configured with. The
 * protocol half is stateless, which is what lets it be a route on this worker rather than
 * a deployment of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { readContent } from "~/app/services/content";
import mcp from "~/bootstrap/mcp";
import { POLICY_COMPONENTS } from "~/resources/components/markdown-components";
import mcpSource from "~/resources/content/mcp.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import PageLayout from "~/resources/layouts/page";
import routes from "~/routes/web";

/** The one-sentence summary a search result and a link preview show. */
const DESCRIPTION =
	"Search and read the @sdxc package documentation over the Model Context Protocol: one stateless endpoint, every tool read-only, no credential.";

/** Answers a `POST` as the protocol, with the router's own context in hand. */
export function mcpEndpoint(ctx: RequestContext): Promise<Response> {
	return mcp.fetch(ctx);
}

/** Renders the page a person reaches by opening the endpoint's URL. */
export default createAction(routes.mcp, async (ctx) => {
	let content = readContent(mcpSource);

	if (isFailure(content)) {
		ctx.log.fail(content.error, { line: content.error.position?.start.line ?? null });
		throw content.error;
	}

	let response = await ctx.render(
		<DocumentLayout
			title="MCP endpoint — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<PageLayout
				eyebrow="For agents"
				title="The MCP endpoint"
				description={DESCRIPTION}
				activePath={routes.mcp.href()}
			>
				{toRemix(content.data, { components: POLICY_COMPONENTS })}
			</PageLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});
