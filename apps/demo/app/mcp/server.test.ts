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

import { outbox } from "~/app/lib/mailer";
import { bindModels, PostingFactory } from "~/app/lib/test/models";
import { createTestDatabase, fetchApp, ORIGIN } from "~/app/lib/test/router";

/** What the endpoint answered, in the fields these tests read. */
interface Body {
	result?: {
		tools?: Array<{ name: string }>;
		content?: Array<{ text?: string }>;
		isError?: boolean;
	};
	error?: { code: number };
}

let db: Database;
let models: Awaited<ReturnType<typeof bindModels>>["models"];
let factories: Awaited<ReturnType<typeof bindModels>>["factories"];

beforeEach(async () => {
	db = await createTestDatabase();
	({ models, factories } = await bindModels(db));
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

/** A complete posting, the fields both the form and `publish_job` require. */
const POSTING = {
	title: "Senior Remix Engineer",
	company: "Acme",
	location: "Remote",
	salary: "$150k – $180k",
	description: "We build things with Remix v3.",
	contact_email: "hiring@acme.test",
};

test("publishes the list, search, read and publish tools", async () => {
	let body = await send("tools/list");

	expect(body.result?.tools?.map((it) => it.name)).toEqual(
		expect.arrayContaining(["list_jobs", "search_jobs", "get_job", "publish_job"]),
	);
});

test("lists every open position", async () => {
	await factories.create(PostingFactory);
	await factories.create(PostingFactory, { title: "Staff Remix Engineer" });

	let body = await send("tools/call", { name: "list_jobs", arguments: {} });
	let listed = JSON.parse(body.result?.content?.[0]?.text ?? "[]") as Array<{ title: string }>;

	expect(listed.map((it) => it.title).sort()).toEqual([
		"Senior Remix Engineer",
		"Staff Remix Engineer",
	]);
});

test("reads one position back as Markdown", async () => {
	let posting = await factories.create(PostingFactory);

	let body = await send("tools/call", { name: "get_job", arguments: { id: posting.id } });

	expect(body.result?.content?.[0]?.text).toBe(
		"# Senior Remix Engineer\n\n**Acme** — Remote — $150k – $180k\n\nWe build things with Remix v3.\n\nApply: hiring@acme.test",
	);
});

test("tells the model when no position has the id it asked for", async () => {
	let body = await send("tools/call", { name: "get_job", arguments: { id: "job_missing" } });

	expect(body.result?.isError).toBe(true);
	expect(body.result?.content?.[0]?.text).toContain("search_jobs");
});

test("publishes a position an agent submits onto the board", async () => {
	let body = await send("tools/call", { name: "publish_job", arguments: POSTING });

	expect(body.result?.isError).toBeUndefined();
	expect(body.result?.content?.[0]?.text).toContain("# Senior Remix Engineer");
	expect((await models.postings.listOpen(10)).map((it) => it.title)).toEqual([
		"Senior Remix Engineer",
	]);
});

test("mails the poster of a position an agent publishes, as the submit form does", async () => {
	outbox.clear();

	await send("tools/call", { name: "publish_job", arguments: POSTING });

	expect(outbox.messages.map((message) => message.to[0]?.email)).toEqual(["hiring@acme.test"]);
});

test("refuses a position without a valid contact email", async () => {
	let body = await send("tools/call", {
		name: "publish_job",
		arguments: { ...POSTING, contact_email: "not an email" },
	});

	expect(body.error?.code).toBe(-32602);
	expect(await models.postings.listOpen(10)).toEqual([]);
});

test("answers a search with the matching position", async () => {
	await factories.create(PostingFactory);

	let body = await send("tools/call", { name: "search_jobs", arguments: { query: "Remix" } });

	expect(body.result?.content?.[0]?.text).toContain("Senior Remix Engineer");
});
