/**
 * Tests the `/mcp` page in both of its languages and both of its formats.
 *
 * Rendered through the real renderer and the real routes, because the page's whole job is
 * to be correct about a server somebody is about to configure: a stale tool name sends a
 * reader to a client that then fails for reasons the page caused. The content is static
 * Markdown, so nothing derives those names any more — the drift check is here instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { walk, walkResources } from "@pkg/mcp";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { MCP_RATE_LIMIT } from "~/app/mcp/rate-limit";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import routes from "~/routes/web";

import { createHtmlRenderer } from "../../../bootstrap/app";

import mcpPage, { mcpMarkdownPage } from "./mcp";

/** Fetches a page through a router carrying only what the controllers need. */
async function fetchPage(url: string, headers: Record<string, string> = {}): Promise<Response> {
	let router = createRouter({ middleware: [renderWith(createHtmlRenderer)] });
	router.map(routes.mcp.index, mcpPage);
	router.map(routes.mcpMarkdown, mcpMarkdownPage);

	return await router.fetch(new Request(url, { headers }));
}

/** Fetches a page and reads its body. */
async function body(url: string, headers: Record<string, string> = {}): Promise<string> {
	return await (await fetchPage(url, headers)).text();
}

const PAGE = "https://sergiodxa.com/mcp";

describe("GET /mcp", () => {
	test("renders the English page by default", async () => {
		let html = await body(PAGE);

		expect(html).toContain("MCP server");
		expect(html).toContain("This blog speaks the");
	});

	test("names the endpoint", async () => {
		let html = await body(PAGE);

		expect(html).toContain("sergiodxa.com/mcp");
	});

	test("gives a copyable configuration", async () => {
		// Asserted against the Markdown rather than the HTML: a fenced block is syntax
		// highlighted into spans, so the command is not one contiguous string on the page —
		// which is exactly why the Markdown twin is the copyable one.
		let source = await body("https://sergiodxa.com/mcp.md");

		expect(source).toContain("claude mcp add --transport http sergiodxa");
		expect(source).toContain('"mcpServers"');
		// Claude Desktop does not speak this protocol revision yet, so the bridge is the only
		// way in for it and has to be on the page.
		expect(source).toContain("@abluva/mcp-remote@latest");
		expect(source).toContain("2026-07-28");
	});

	test("names every tool the server actually serves", async () => {
		// The content is prose now, so this is what stops it describing a tool that was
		// renamed — in both languages, since a reader of either configures the same server.
		let english = await body(PAGE);
		let spanish = await body(`${PAGE}?lang=es-AR`);

		for (let tool of walk(toolset)) {
			expect(english).toContain(tool.name);
			expect(spanish).toContain(tool.name);
		}
	});

	test("names every resource template", async () => {
		let html = await body(PAGE);

		for (let resource of walkResources(resourceset)) {
			expect(html).toContain(resource.descriptor.uriTemplate);
		}
	});

	test("states the rate limit that is actually enforced", async () => {
		let english = await body(PAGE);
		let spanish = await body(`${PAGE}?lang=es-AR`);

		// Interpolated from the constant the middleware enforces, so prose that drifts from
		// the binding fails here rather than misleading a reader.
		expect(english).toContain(`${MCP_RATE_LIMIT} requests a minute`);
		expect(spanish).toContain(`${MCP_RATE_LIMIT} pedidos por minuto`);
	});

	test("renders the Markdown as HTML, not as escaped source", async () => {
		// The whole point of storing the page as Markdown is that it is parsed; a regression in
		// the parser or the view would show as the source itself on the page.
		let html = await body(PAGE);
		let article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));

		expect(article).toContain("<h2");
		expect(article).toContain("<pre");
		expect(article).toContain("<ul");
		expect(article).not.toContain("## ");
		expect(article).not.toContain("```");
	});

	test("is a full document titled for the browser tab", async () => {
		let html = await body(PAGE);

		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html).toContain('<title data-key="title">MCP server</title>');
	});
});

describe("language", () => {
	test("serves Spanish to a reader whose browser asks for it", async () => {
		let html = await body(PAGE, { "Accept-Language": "es-MX,es;q=0.9,en;q=0.8" });

		expect(html).toContain("Servidor MCP");
		expect(html).toContain("Este blog habla el");
	});

	test("matches any Spanish against the one translation", async () => {
		// The page is written in Argentine Spanish. The tag says which Spanish it is, not which
		// readers it is for, so `es-419` and `es-MX` get it too.
		for (let tag of ["es-419", "es-MX", "es"]) {
			expect(await body(PAGE, { "Accept-Language": tag })).toContain("Servidor MCP");
		}
	});

	test("lets an explicit choice override the browser", async () => {
		// The only way to link somebody to a translation, or to share one.
		let html = await body(`${PAGE}?lang=en`, { "Accept-Language": "es" });

		expect(html).toContain("MCP server");
		expect(html).not.toContain("Este blog habla el");
	});

	test("falls back to English for a language it is not written in", async () => {
		let html = await body(PAGE, { "Accept-Language": "ja,ko;q=0.9" });

		expect(html).toContain("This blog speaks the");
	});

	test("offers the other translation", async () => {
		let english = await body(PAGE);
		let spanish = await body(`${PAGE}?lang=es-AR`);

		expect(english).toContain("?lang=es-AR");
		expect(spanish).toContain("?lang=en");
	});

	test("accepts a bare language in ?lang, not just the exact tag", async () => {
		// Somebody hand-editing the URL writes `es`, not `es-AR`.
		let html = await body(`${PAGE}?lang=es`);

		expect(html).toContain("Este blog habla el");
	});

	test("declares the page's own language to the browser", async () => {
		let english = await body(PAGE);
		let spanish = await body(`${PAGE}?lang=es-AR`);

		expect(english).toContain('<html lang="en"');
		expect(spanish).toContain('<html lang="es-AR"');
	});
});

describe("Markdown", () => {
	test("serves the source at /mcp.md", async () => {
		let response = await fetchPage("https://sergiodxa.com/mcp.md");

		expect(response.headers.get("Content-Type")).toContain("markdown");
		expect(await response.text()).toContain("# ");
	});

	test("negotiates Markdown from the Accept header", async () => {
		let response = await fetchPage(PAGE, { Accept: "text/markdown" });

		expect(response.headers.get("Content-Type")).toContain("markdown");
	});

	test("strips the frontmatter, so the body starts as prose", async () => {
		let text = await body("https://sergiodxa.com/mcp.md");

		expect(text.startsWith("---")).toBe(false);
		expect(text).toContain("Model Context Protocol");
	});

	test("serves Markdown in the reader's language too", async () => {
		let text = await body("https://sergiodxa.com/mcp.md", { "Accept-Language": "es-AR" });

		expect(text).toContain("Este blog habla el");
	});

	test("still answers HTML to a browser", async () => {
		let response = await fetchPage(PAGE, { Accept: "text/html,application/xhtml+xml" });

		expect(response.headers.get("Content-Type")).toContain("text/html");
	});
});
