/**
 * Tests for the page `GET /mcp` renders. Its example exchange is copied by hand into a
 * terminal, so the protocol revision it sends and the tools it names are checked against
 * what the server at the same address actually accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LATEST_PROTOCOL_VERSION } from "@sdxc/mcp/server";
import { describe, expect, test } from "vitest";

import toolset from "~/app/mcp/tools";
import { fetchApp } from "~/app/test/router";

describe("GET /mcp", () => {
	test("opens on one h1 under the site header", async () => {
		let body = await (await fetchApp("/mcp")).text();

		expect(body.match(/<h1[\s>]/g)).toHaveLength(1);
		expect(body).toContain("The MCP endpoint");
	});

	test("sends the protocol revision the server speaks in its example exchange", async () => {
		let body = await (await fetchApp("/mcp")).text();
		let revisions = new Set(body.match(/\b20\d\d-\d\d-\d\d\b/g));

		expect(body).toContain(`MCP-Protocol-Version: ${LATEST_PROTOCOL_VERSION}`);
		expect([...revisions]).toEqual([LATEST_PROTOCOL_VERSION]);
	});

	test("names every tool the server declares", async () => {
		let body = await (await fetchApp("/mcp")).text();

		for (let tool of Object.values(toolset)) expect(body).toContain(tool.name);
	});

	test("connects every client through mcp-bridge from @sdxc/mcp", async () => {
		let body = await (await fetchApp("/mcp")).text();

		expect(body).toContain("@sdxc/mcp@latest");
		expect(body).toContain("mcp-bridge");
		expect(body).not.toContain("--transport http");
		expect(body).not.toMatch(
			/&quot;url&quot;:\s*&quot;https:\/\/sdxc\.dev\/mcp&quot;|"url":\s*"https:\/\/sdxc\.dev\/mcp"/,
		);
	});
});
