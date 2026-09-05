/**
 * Tests for what the handler writes into the invocation's current log.
 *
 * Each case runs a request inside a `Log` with a collecting sink and reads the emitted
 * record, since the fields are the contract: an operator filters on `mcp.tool` and
 * `mcp.is_error`, and a resource read must record its pattern, keeping the slug out of the
 * index. The last case runs with no log open, which has to be indistinguishable from before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { describe, expect, test, vi } from "vitest";

import { ToolError } from "./errors.js";
import { createHandler } from "./handler.js";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "./protocol.js";
import { resource } from "./resources.js";
import { tool } from "./tools.js";

const ARTICLE = "https://sergiodxa.com/articles/:slug.md";

const GET_POST = tool("get_post", {
	description: "Reads one post.",
	input: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
});

const ARTICLE_RESOURCE = resource(ARTICLE, { name: "Article", mimeType: "text/markdown" });

/** Every field these tests read off a response body. */
interface Body {
	result?: { isError?: boolean; content?: Array<{ text: string }> };
	error?: { code?: number };
}

/** Builds a POST carrying the headers and `_meta` this revision requires. */
function send(method: string, params: Record<string, unknown> = {}): Request {
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": method,
	};
	if (method === "tools/call" && typeof params.name === "string") {
		headers["Mcp-Name"] = params.name;
	}
	if (method === "resources/read" && typeof params.uri === "string") {
		headers["Mcp-Name"] = params.uri;
	}

	return new Request("https://example.com/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params: {
				...params,
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

/** A handler whose one tool and one resource can each succeed, refuse, or blow up. */
function build(onError?: (error: unknown) => void) {
	let mcp = createHandler({ name: "blog", version: "1.0.0", onError });

	mcp.tools.map(GET_POST, (ctx) => {
		if (ctx.input.slug === "draft") throw new ToolError("That post is still a draft.");
		if (ctx.input.slug === "broken") throw new Error("D1_ERROR: secret_internal_field");
		return { slug: ctx.input.slug };
	});

	mcp.resources.map(ARTICLE_RESOURCE, {
		read: (ctx) => {
			if (ctx.variables.slug === "broken") throw new Error("D1_ERROR: secret_internal_field");
			return `# ${ctx.variables.slug}`;
		},
	});

	return mcp;
}

/** Runs one request inside a fresh log and returns the record it emitted with the response. */
async function logged(
	request: Request,
	mcp = build(),
): Promise<{ record: Record<string, unknown>; body: Body }> {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });

	let response = await log.run(() => mcp.fetch(request));

	return { record: records[0] ?? {}, body: (await response.json()) as Body };
}

describe("the current log", () => {
	test("records the method and protocol version of every request", async () => {
		let { record } = await logged(send("tools/list"));

		expect(record).toMatchObject({
			"mcp.method": "tools/list",
			"mcp.protocol_version": LATEST_PROTOCOL_VERSION,
			outcome: "ok",
		});
	});

	test("records the tool and a clean result", async () => {
		let { record } = await logged(
			send("tools/call", { name: "get_post", arguments: { slug: "remix" } }),
		);

		expect(record).toMatchObject({
			"mcp.method": "tools/call",
			"mcp.tool": "get_post",
			"mcp.is_error": false,
			outcome: "ok",
		});
	});

	test("marks a ToolError result as an error without failing the log", async () => {
		let { record, body } = await logged(
			send("tools/call", { name: "get_post", arguments: { slug: "draft" } }),
		);

		expect(body.result?.isError).toBe(true);
		expect(record).toMatchObject({ "mcp.tool": "get_post", "mcp.is_error": true, outcome: "ok" });
		expect(record).not.toHaveProperty("error.message");
	});

	test("marks refused arguments as an error on the tool they were sent to", async () => {
		let { record } = await logged(send("tools/call", { name: "get_post", arguments: {} }));

		expect(record).toMatchObject({ "mcp.tool": "get_post", "mcp.is_error": true });
	});

	test("fails the log on an unexpected exception while the model still sees a generic result", async () => {
		let onError = vi.fn();
		let { record, body } = await logged(
			send("tools/call", { name: "get_post", arguments: { slug: "broken" } }),
			build(onError),
		);

		expect(body.result?.isError).toBe(true);
		expect(body.result?.content?.[0]?.text).toBe("The get_post tool failed unexpectedly.");
		expect(record).toMatchObject({
			"mcp.tool": "get_post",
			"mcp.is_error": true,
			outcome: "error",
			"error.message": "D1_ERROR: secret_internal_field",
		});
		expect(onError).toHaveBeenCalledTimes(1);
	});

	test("records the pattern of a read resource, never its URI", async () => {
		let { record } = await logged(
			send("resources/read", { uri: ARTICLE_RESOURCE.href({ slug: "remix-v3" }) }),
		);

		expect(record).toMatchObject({ "mcp.method": "resources/read", "mcp.resource": ARTICLE });
		expect(JSON.stringify(record)).not.toContain("remix-v3");
	});

	test("fails the log when a resource read throws", async () => {
		let { record, body } = await logged(
			send("resources/read", { uri: ARTICLE_RESOURCE.href({ slug: "broken" }) }),
		);

		expect(body.error?.code).toBe(-32603);
		expect(record).toMatchObject({
			"mcp.resource": ARTICLE,
			outcome: "error",
			"error.message": "D1_ERROR: secret_internal_field",
		});
	});
});

describe("with no current log", () => {
	test("serves every path exactly as before", async () => {
		let onError = vi.fn();
		let mcp = build(onError);

		let ok = await mcp.fetch(send("tools/call", { name: "get_post", arguments: { slug: "x" } }));
		let broken = await mcp.fetch(
			send("tools/call", { name: "get_post", arguments: { slug: "broken" } }),
		);
		let read = await mcp.fetch(
			send("resources/read", { uri: ARTICLE_RESOURCE.href({ slug: "remix-v3" }) }),
		);

		expect(ok.status).toBe(200);
		expect(((await ok.json()) as Body).result?.isError).toBeUndefined();
		expect(((await broken.json()) as Body).result?.isError).toBe(true);
		expect(read.status).toBe(200);
		expect(onError).toHaveBeenCalledTimes(1);
	});
});
