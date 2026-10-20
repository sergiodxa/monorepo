/**
 * Drives `<page>.png` requests through a router with the card middleware over a seeded test
 * database: a public status page answers its card as a PNG and stores it, a repeat with the
 * card's version is served from storage, and a private or unknown page has no card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Database } from "remix/data-table";

import {
	createAnalyticsEngine,
	createEnv,
	createKVNamespace,
	createQueue,
} from "@sdxc/cloudflare-mocks";
import { database } from "@sdxc/database-middleware";
import { parseFont } from "@sdxc/font";
import { decode } from "@sdxc/png";
import { success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryFileStorage } from "remix/file-storage/memory";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { createTestDatabase } from "~/app/test/db";
import {
	monitorDailyStats,
	monitors,
	statusPageMonitors,
	statusPages,
	teams,
} from "~/database/schema";

/** The store every request in this file shares, so a repeat finds the first request's card. */
const STORAGE = createMemoryFileStorage();

/** Writes the middleware defers, awaited by a test that reads storage after them. */
const PENDING: Promise<unknown>[] = [];

/** Reads one bundled face from disk, as the Worker receives it as a data module. */
function load(name: string) {
	let result = parseFont(readFileSync(join(import.meta.dirname, "../../../resources/fonts", name)));
	if (result.status === "failure") throw result.error;
	return result.data;
}

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		KV: createKVNamespace(),
		PING_RESULTS: createAnalyticsEngine(),
		QUEUE: createQueue(),
	}),
	waitUntil: (promise: Promise<unknown>) => void PENDING.push(promise),
}));
vi.doMock("~/app/models/social-cards", () => ({ socialCards: () => STORAGE }));
vi.doMock("~/app/initializers/social-card-fonts", () => {
	let fonts = success({
		regular: load("inter-regular.ttf.bin"),
		semibold: load("inter-semibold.ttf.bin"),
		mono: load("jetbrains-mono-regular.ttf.bin"),
	});
	return { socialCardFonts: () => fonts };
});

let { default: models } = await import("~/app/http/middleware/models");
let { default: socialCards } = await import("~/app/http/middleware/social-cards");

/** The Analytics Engine SQL API endpoint the overview's HTTP summaries are queried through. */
const SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Today and yesterday as the daily stats key them. */
function recentDays(): [string, string] {
	let now = Date.now();
	return [
		new Date(now).toISOString().slice(0, 10),
		new Date(now - 86_400_000).toISOString().slice(0, 10),
	];
}

/** A public status page with one HTTP monitor, yesterday degraded and today up. */
async function seedPage(db: Database, isPublic = true) {
	let team = await db.create(
		teams,
		{
			id: generateUUID(),
			owner_id: "owner-1",
			name: "Acme",
			slug: `acme-${generateUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
	let monitor = await db.create(
		monitors,
		{
			id: generateUUID(),
			team_id: team.id,
			author_id: "member-1",
			enabled_at: Date.now(),
			name: "API",
			url: "https://example.com",
		},
		{ touch: true, returnRow: true },
	);
	let page = await db.create(
		statusPages,
		{
			id: generateUUID(),
			team_id: team.id,
			name: "Acme Status",
			slug: `acme-${generateUUID().slice(0, 8)}`,
			title: "Acme Status",
			description: null,
			logo_url: null,
			custom_domain: null,
			is_public: isPublic,
			show_overall_status: true,
		},
		{ touch: true, returnRow: true },
	);
	await db.create(statusPageMonitors, {
		status_page_id: page.id,
		monitor_id: monitor.id,
		display_name: null,
		order: 0,
	});
	let [today, yesterday] = recentDays();
	for (let [date, status, successful] of [
		[yesterday, "degraded", 90],
		[today, "up", 10],
	] as const) {
		await db.create(monitorDailyStats, {
			id: generateUUID(),
			created_at: Date.now(),
			monitor_id: monitor.id,
			monitor_type: "http",
			date,
			total_checks: successful === 90 ? 100 : 10,
			successful_checks: successful,
			failed_checks: successful === 90 ? 10 : 0,
			avg_response_time_ms: 100,
			max_response_time_ms: 200,
			p95_response_time_ms: 150,
			status,
		});
	}
	server.use(
		http.post(SQL_URL, () =>
			HttpResponse.json({
				data: [
					{
						monitorId: monitor.id,
						totalChecks: 10,
						upChecks: 10,
						degradedChecks: 0,
						downChecks: 0,
						maxResponseTimeMs: 120,
					},
				],
			}),
		),
	);
	return page;
}

/** Requests a path through a router running the card middleware ahead of a 404 handler. */
async function get(db: Database, path: string): Promise<Response> {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			socialCards((request): Promise<Response> => router.fetch(request)),
		],
		defaultHandler: () => new Response("Not found", { status: 404 }),
	});
	return router.fetch(new Request(new URL(path, "https://uptime.test")));
}

describe("GET <status page>.png", () => {
	test("a public status page answers its card, drawn from its services, and stores it", async () => {
		let { db } = createTestDatabase();
		let page = await seedPage(db);

		let response = await get(db, `/status/${page.slug}.png`);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toBe("public, max-age=300");
		let image = await decode(new Uint8Array(await response.arrayBuffer()));
		expect(image.status === "success" && [image.data.width, image.data.height]).toEqual([
			1200, 630,
		]);

		await Promise.all(PENDING);
		let stored = await STORAGE.list({ prefix: "uptime/1/" });
		expect(stored.files.length).toBeGreaterThan(0);
	});

	test("a request naming a stored card's version is served from storage", async () => {
		let { db } = createTestDatabase();
		let page = await seedPage(db);
		let key = "uptime/1/storedcard.png";
		await STORAGE.set(
			key,
			new File([new Uint8Array([137, 80, 78, 71])], "card.png", { type: "image/png" }),
		);

		let response = await get(db, `/status/${page.slug}.png?v=storedcard`);
		expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([137, 80, 78, 71]);
	});

	test("a private or unknown status page has no card", async () => {
		let { db } = createTestDatabase();
		let page = await seedPage(db, false);
		expect((await get(db, `/status/${page.slug}.png`)).status).toBe(404);
		expect((await get(db, "/status/nobody.png")).status).toBe(404);
	});

	test("a request that is not for a PNG continues to the router", async () => {
		let { db } = createTestDatabase();
		expect((await get(db, "/status/anything")).status).toBe(404);
	});
});
