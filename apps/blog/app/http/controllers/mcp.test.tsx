/**
 * Tests the `GET /mcp` page.
 *
 * Rendered through the real renderer and the real route, because the page's whole job is to
 * be correct about a server somebody is about to configure: a stale tool name or a wrong
 * endpoint sends a reader to a client that then fails for reasons the page caused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { walk, walkResources } from "@pkg/mcp";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import routes from "~/routes/web";

import { createHtmlRenderer } from "../../../bootstrap/app";

import mcpPage from "./mcp";

/** Fetches the page through a router carrying only what the controller needs. */
async function renderPage(url = "https://sergiodxa.com/mcp"): Promise<string> {
	let router = createRouter({ middleware: [renderWith(createHtmlRenderer)] });
	router.map(routes.mcp.index, mcpPage);

	let response = await router.fetch(new Request(url));
	return await response.text();
}

describe("GET /mcp", () => {
	test("names the endpoint at the origin the reader is reading it from", async () => {
		// Built from the request rather than hardcoded, so the address the page tells somebody
		// to paste is the one they arrived at.
		let html = await renderPage("https://sergiodxa.com/mcp");

		expect(html).toContain("https://sergiodxa.com/mcp");
	});

	test("gives a copyable client configuration", async () => {
		let html = await renderPage();

		expect(html).toContain("claude mcp add --transport http sergiodxa");
		expect(html).toContain("mcpServers");
	});

	test("lists every tool the server actually serves", async () => {
		let html = await renderPage();

		for (let tool of walk(toolset)) {
			expect(html).toContain(tool.descriptor.name);
			expect(html).toContain(tool.descriptor.description);
		}
	});

	test("lists every resource, with the template a client would expand", async () => {
		let html = await renderPage();

		for (let resource of walkResources(resourceset)) {
			expect(html).toContain(resource.descriptor.uriTemplate);
		}
	});

	test("states the rate limit that is actually enforced", async () => {
		let html = await renderPage();

		expect(html).toContain("60 requests a minute");
	});

	test("is a full document titled for the browser tab, not just the heading", async () => {
		let html = await renderPage();

		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html).toContain('<title data-key="title">MCP server</title>');
	});
});
