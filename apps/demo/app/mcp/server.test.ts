/**
 * Drives the MCP endpoint the way a client does: whole requests through the app's own
 * router. The endpoint is mounted as an ordinary route, so what it answers has already
 * passed the same middleware chain every page goes through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { beforeEach, expect, test } from "vitest";

import Job from "~/app/data/posting";
import { createTestDatabase, fetchApp, ORIGIN } from "~/app/lib/test/router";

/** What the endpoint answered, in the fields these tests read. */
interface Body {
	result?: {
		tools?: Array<{ name: string }>;
		content?: Array<{ text?: string }>;
	};
}

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

/** Sends one JSON-RPC call through the whole router and reads back what it answered. */
async function send(method: string, params: Record<string, unknown> = {}): Promise<Body> {
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": method,
		origin: ORIGIN,
	};

	if (typeof params.name === "string") headers["Mcp-Name"] = params.name;

	let response = await fetchApp(db, "/mcp", {
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

	return (await response.json()) as Body;
}

test("publishes the search tool", async () => {
	let body = await send("tools/list");

	expect(body.result?.tools?.map((it) => it.name)).toContain("search_jobs");
});

test("answers a search with the matching position", async () => {
	await Job.publish(db, {
		title: "Senior Remix Engineer",
		company: "Acme",
		location: "Remote",
		salary: "$150k – $180k",
		description: "We build things with Remix v3.",
		contact_email: "hiring@acme.test",
	});

	let body = await send("tools/call", { name: "search_jobs", arguments: { query: "Remix" } });

	expect(body.result?.content?.[0]?.text).toContain("Senior Remix Engineer");
});
