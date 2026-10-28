/**
 * Drives the Uptime MCP endpoint the way a client does: whole requests through a router
 * that mounts the same auth chain as production, against an in-memory SQLite database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse as parseChallenge } from "@sdxc/auth/bearer-challenge";
import { createEnv } from "@sdxc/cloudflare-mocks";
import { database } from "@sdxc/database-middleware";
import featureFlags from "@sdxc/flags/middleware/router";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import { flags } from "~/app/initializers/flags";
import { createTestDatabase } from "~/app/test/db";
import { monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();
	return { ...original, env: createEnv<Env>({}) };
});
vi.doMock("cloudflare:sockets", () => ({
	connect: () => {
		throw new Error("MCP list/read tests must not open a socket");
	},
}));

let { default: models } = await import("~/app/http/middleware/models");
let { default: requireApiKey } = await import("~/app/http/middleware/require-api-key");
let { default: requireMcpScope } = await import("~/app/http/middleware/require-mcp-scope");
let { default: mcpAccess } = await import("~/app/http/middleware/mcp-access");
let { default: mcp } = await import("~/app/initializers/mcp");
let { bindModels } = await import("~/app/test/models");

type Db = ReturnType<typeof createTestDatabase>["db"];

/** What one tools/list or tools/call answer carries for these assertions. */
interface Body {
	result?: {
		tools?: Array<{ name: string }>;
		content?: Array<{ text?: string }>;
		isError?: boolean;
	};
	error?: { code?: number; message?: string };
}

const ENDPOINT = `https://uptime.test${routes.mcp.action.href()}`;

async function seedTeam(db: Db) {
	return await db.create(
		teams,
		{
			id: generateUUID(),
			owner_id: generateUUID(),
			name: "Acme",
			slug: `acme-${generateUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function seedKey(db: Db, teamId: string, scopes: ApiKeyScope[]) {
	return unwrap(
		await bindModels(db).apiKeys.issue(teamId, { name: "agent", scopes, expires_at: null }),
	);
}

/** One MCP JSON-RPC request with the headers this protocol revision requires. */
function mcpRequest(method: string, params: Record<string, unknown> = {}, key?: string): Request {
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": method,
	};
	if (key !== undefined) headers.Authorization = `Bearer ${key}`;
	if (method === "tools/call" && typeof params.name === "string") {
		headers["Mcp-Name"] = params.name;
	}

	return new Request(ENDPOINT, {
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

async function dispatch(db: Db, request: Request): Promise<Response> {
	let router = createRouter({
		middleware: [asyncContext(), database(db), models(), featureFlags(flags)],
	});
	router.map(routes.mcp.action, {
		middleware: [requireApiKey, requireMcpScope, mcpAccess],
		handler: (ctx) => mcp.fetch(ctx),
	});
	return router.fetch(request);
}

describe("MCP endpoint", () => {
	test("refuses a request with no API key", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, mcpRequest("tools/list"));

		expect(response.status).toBe(401);
	});

	test("refuses a key that lacks the mcp scope", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		let { key } = await seedKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, mcpRequest("tools/list", {}, key));

		expect(response.status).toBe(403);
		let challenges = unwrap(parseChallenge(response.headers.get("WWW-Authenticate") ?? ""));
		expect(challenges[0]?.error).toBe("insufficient_scope");
		expect(challenges[0]?.scope).toEqual(["mcp"]);
	});

	test("lists only tools the key's resource scopes allow", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		let { key } = await seedKey(db, team.id, ["mcp", "monitors:read"]);

		let response = await dispatch(db, mcpRequest("tools/list", {}, key));
		expect(response.status).toBe(200);

		let body = (await response.json()) as Body;
		let names = (body.result?.tools ?? []).map((tool) => tool.name);

		expect(names).toContain("list_monitors");
		expect(names).toContain("get_monitor");
		expect(names).not.toContain("create_monitor");
		expect(names).not.toContain("list_alerts");
	});

	test("lists monitors through the matching tool", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		let { key } = await seedKey(db, team.id, ["mcp", "monitors:read"]);

		await db.create(
			monitors,
			{
				id: generateUUID(),
				team_id: team.id,
				author_id: team.owner_id,
				name: "Example",
				url: "https://example.com",
				method: "HEAD",
				expected_status: 200,
				interval_seconds: 60,
				degraded_after_ms: 5000,
				timeout_seconds: 10,
				location_hint: "wnam",
				enabled_at: Date.now(),
				ssl_monitoring_enabled: false,
				ssl_expiry_warning_days: 30,
				ssl_expires_at: null,
				ssl_issuer: null,
				ssl_last_checked_at: null,
				ssl_status: "unknown",
			},
			{ touch: true },
		);

		let response = await dispatch(
			db,
			mcpRequest("tools/call", { name: "list_monitors", arguments: {} }, key),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as Body;
		expect(body.result?.isError).not.toBe(true);

		let answer = JSON.parse(body.result?.content?.[0]?.text ?? "{}") as {
			monitors: Array<{ name: string }>;
			total: number;
		};
		expect(answer.total).toBe(1);
		expect(answer.monitors[0]?.name).toBe("Example");
	});
});
