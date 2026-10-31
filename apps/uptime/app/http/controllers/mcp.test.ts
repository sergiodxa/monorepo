/**
 * The public `GET /mcp` page: every visitor sees the mcp-bridge config the product documents,
 * an anonymous one with the sign-in action, a signed-in one with the copy button and dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import { createTestDatabase } from "~/app/test/db";
import routes from "~/routes/web";

let viewer: Viewer | null = null;

let { db } = createTestDatabase();

vi.doMock("~/app/http/middleware/auth", () => {
	let passThrough = (_ctx: unknown, next: () => Promise<Response>) => next();
	return {
		auth: passThrough,
		default: passThrough,
		getViewer: () => viewer,
		isAuthenticated: () => viewer !== null,
	};
});
vi.doMock("~/app/http/middleware/session", () => ({
	createSessionMiddleware: () =>
		session(createCookie("uptime-test", { secrets: ["test"] }), createMemorySessionStorage()),
}));
vi.doMock("~/app/initializers/database", () => ({ openDatabase: () => db }));

let { createWebRouter } = await import("~/app/initializers/router");
let router = createWebRouter({ kv: env.KV, cookieSecret: "test", secure: false });

describe("GET /mcp", () => {
	test("sells MCP to an anonymous visitor with the config and a sign-in action", async () => {
		viewer = null;
		let response = await router.fetch(
			new Request(`https://uptime.test${routes.mcp.index.href()}`, {
				headers: { Origin: "https://uptime.test" },
			}),
		);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Uptime");
		expect(body).toContain("Agent-first monitoring");
		expect(body).toContain("Streamable HTTP");
		expect(body).toContain("@sdxc/mcp@latest");
		expect(body).toContain(`action="${routes.auth.action.href()}"`);
		expect(body).not.toContain("Copy config");
	});

	test("hands a signed-in teammate the config, the copy button and the dashboard", async () => {
		viewer = {
			id: generateUUID(),
			name: "Ada",
			email: "ada@example.com",
			avatar: "",
		};
		let response = await router.fetch(
			new Request(`https://uptime.test${routes.mcp.index.href()}`, {
				headers: { Origin: "https://uptime.test" },
			}),
		);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("@sdxc/mcp@latest");
		expect(body).toContain("--header");
		expect(body).toContain("Authorization:Bearer ${UPTIME_MCP_TOKEN}");
		expect(body).toContain("2026-07-28");
		expect(body).toContain("https://uptime.sergiodxa.com/mcp");
		expect(body).toContain("Copy config");
		expect(body).toContain(`href="${routes.app.index.href()}"`);
	});
});
