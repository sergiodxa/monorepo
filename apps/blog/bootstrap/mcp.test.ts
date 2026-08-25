/**
 * Tests the MCP server's wiring: which tools and resources it actually serves.
 *
 * Every case here goes through a real request but touches no database, because the paths
 * that describe the server — `server/discover`, `tools/list`, `resources/templates/list` —
 * never read one. That is also what makes them worth asserting: mapping is what registers a
 * tool, so a tool declared in `app/mcp/tools.ts` and never mapped in `bootstrap/mcp.ts`
 * disappears silently, and the expected lists below are the only thing that notices.
 *
 * The handlers themselves need a database this app has no test harness for, so their
 * behaviour is covered by `@pkg/mcp`'s own tests plus the repositories they call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LATEST_PROTOCOL_VERSION, MetaKey } from "@pkg/mcp";
import { describe, expect, test } from "vitest";

import resourceset from "~/app/mcp/resources";

import mcp from "./mcp";

/** Every tool this server is expected to serve, in the order it lists them. */
const EXPECTED_TOOLS = [
	"search_posts",
	"list_posts",
	"get_post",
	"list_glossary",
	"get_glossary_term",
	"list_bookmarks",
];

/** Fields these tests read off a response body. */
interface Body {
	result?: {
		capabilities?: Record<string, unknown>;
		instructions?: string;
		tools?: Array<{ name: string; description: string; annotations?: Record<string, unknown> }>;
		resourceTemplates?: Array<{ uriTemplate: string; name: string; mimeType?: string }>;
		ttlMs?: number;
		cacheScope?: string;
	};
	error?: { code?: number };
}

/** Sends one MCP request with the headers and `_meta` the protocol requires. */
async function call(method: string): Promise<Body> {
	let response = await mcp.fetch(
		new Request("https://sergiodxa.com/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
				"Mcp-Method": method,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method,
				params: {
					_meta: {
						[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
						[MetaKey.ClientCapabilities]: {},
					},
				},
			}),
		}),
	);

	return (await response.json()) as Body;
}

describe("server/discover", () => {
	test("advertises both capabilities and identifies the blog", async () => {
		let body = await call("server/discover");

		expect(body.result?.capabilities).toEqual({
			tools: { listChanged: false },
			resources: {},
		});
		expect(body.result?.instructions).toContain("sergiodxa.com");
	});
});

describe("tools/list", () => {
	test("serves every declared tool, and only those", async () => {
		let body = await call("tools/list");

		expect(body.result?.tools?.map((each) => each.name)).toEqual(EXPECTED_TOOLS);
	});

	test("marks every tool read-only and closed-world", async () => {
		// No tool writes and none reaches past this database, so a client may run any of them
		// without stopping to ask a person.
		let body = await call("tools/list");

		for (let each of body.result?.tools ?? []) {
			expect(each.annotations).toEqual({ readOnlyHint: true, openWorldHint: false });
		}
	});

	test("gives every tool a description a model can choose by", async () => {
		let body = await call("tools/list");

		for (let each of body.result?.tools ?? []) {
			expect(each.description.length).toBeGreaterThan(40);
		}
	});

	test("advertises the list as publicly cacheable, since no tool is conditional", async () => {
		let body = await call("tools/list");

		expect(body.result?.cacheScope).toBe("public");
		expect(body.result?.ttlMs).toBe(600_000);
	});
});

describe("resources/templates/list", () => {
	test("publishes the article and tutorial templates as Markdown", async () => {
		let body = await call("resources/templates/list");

		expect(body.result?.resourceTemplates).toEqual([
			expect.objectContaining({
				uriTemplate: "https://sergiodxa.com/articles/{slug}.md",
				name: "article",
				mimeType: "text/markdown",
			}),
			expect.objectContaining({
				uriTemplate: "https://sergiodxa.com/tutorials/{slug}.md",
				name: "tutorial",
				mimeType: "text/markdown",
			}),
		]);
	});
});

describe("resource URIs", () => {
	test("build the blog's own Markdown URLs", async () => {
		// The URI has to be a URL the blog actually serves, since a client may fetch it
		// directly instead of calling resources/read.
		expect(resourceset.article.href({ slug: "remix-v3" })).toBe(
			"https://sergiodxa.com/articles/remix-v3.md",
		);
		expect(resourceset.tutorial.href({ slug: "use-fetcher" })).toBe(
			"https://sergiodxa.com/tutorials/use-fetcher.md",
		);
	});
});
