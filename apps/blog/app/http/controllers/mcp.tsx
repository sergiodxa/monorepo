/**
 * HTTP actions for the `/mcp` page: the HTML page at `GET /mcp` and its Markdown twin at
 * `GET /mcp.md`, both explaining the MCP server that answers `POST /mcp`.
 *
 * The content is a Markdown file per language, so this controller picks a language,
 * negotiates a format, and renders — the same three steps the post controller takes, for
 * the same reason: an agent asking for Markdown should get Markdown, and a page about
 * serving agents would be a poor place to make that an exception.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@pkg/http/content-type";
import { accepts } from "@pkg/http/negotiate";
import { isFailure } from "@pkg/result";
import { createAction } from "remix/router";

import type { McpPage } from "~/app/services/mcp-page";

import { loadMcpPage, resolveMcpPageLocale } from "~/app/services/mcp-page";
import { McpView } from "~/resources/views/mcp";
import routes from "~/routes/web";

/** Builds a Markdown response, matching how the post route serves its own. */
function markdown(status: number, body: string): Response {
	return new Response(body, { status, headers: { "Content-Type": ct.Markdown } });
}

/**
 * Loads the page for a request's language.
 *
 * @param url The request URL, read for a `?lang=` override.
 * @param request The request, read for `Accept-Language`.
 * @returns The parsed page, or `null` when its source could not be parsed.
 */
async function pageFor(url: URL, request: Request): Promise<McpPage | null> {
	let locale = resolveMcpPageLocale(url, request.headers.get("Accept-Language"));
	let loaded = await loadMcpPage(locale);
	if (isFailure(loaded)) return null;
	return loaded.data;
}

/**
 * Serves the MCP page, as HTML or as Markdown.
 *
 * Markdown is negotiated the way a post negotiates it, so `Accept: text/markdown` reaches
 * the same body `/mcp.md` serves.
 *
 * @returns The page response, or a `500` when its own source will not parse.
 */
export default createAction(routes.mcp.index, async (ctx) => {
	let page = await pageFor(ctx.url, ctx.request);
	if (!page) return markdown(500, "# Error\n\nThis page's source could not be read.\n\n");

	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(200, page.body);
	}

	let model: McpView.Model = {
		title: page.frontmatter.title,
		description: page.frontmatter.description,
		activePath: routes.mcp.index.href(),
		content: page.content,
		markdownHref: routes.mcpMarkdown.href(),
		locale: page.locale,
	};

	return ctx.render(McpView, model);
});

/**
 * Serves the MCP page as Markdown, whatever the request would otherwise accept.
 *
 * The extension is an explicit request, so it overrides negotiation rather than joining it.
 *
 * @returns The page's Markdown body.
 */
export const mcpMarkdownPage = createAction(routes.mcpMarkdown, async (ctx) => {
	let page = await pageFor(ctx.url, ctx.request);
	if (!page) return markdown(500, "# Error\n\nThis page's source could not be read.\n\n");

	return markdown(200, page.body);
});
