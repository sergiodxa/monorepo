/**
 * Tests for the `checkCertificate` job: it reads one monitor's expiry from Certificate
 * Transparency, skips a monitor that types its date or has SSL monitoring off, and
 * enqueues no alert. Cert Spotter is intercepted with MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";

import { createEnv, createKVNamespace, createQueue } from "@sdxc/cloudflare-mocks";
import { Database } from "@sdxc/database-middleware";
import { createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { InsertMonitor } from "~/database/schema";

import { createTestDatabase } from "~/app/test/db";

const SEARCH_URL = "https://api.certspotter.com/v1/issuances";

/** Where an alert would land; the job must leave it empty. */
let queue: QueueMock<unknown> = createQueue<unknown>();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue, KV: createKVNamespace() }),
}));

let jobs = (await import("~/app/jobs")).default;
let checkCertificate = (await import("~/app/jobs/check-certificate")).default;
let { bindModels, publishModels } = await import("~/app/test/models");

/** Every search Cert Spotter received. */
let searches: URL[] = [];

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
	searches = [];
	queue.reset();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every search with one certificate for `names` expiring at `notAfter`. */
function certSpotter(names: string[], notAfter: number) {
	server.use(
		http.get(SEARCH_URL, ({ request }) => {
			searches.push(new URL(request.url));
			return HttpResponse.json([
				{
					id: "1",
					dns_names: names,
					issuer: { friendly_name: "Google Trust Services", name: "CN=WR1" },
					not_before: new Date(Date.now() - 60_000).toISOString(),
					not_after: new Date(notAfter).toISOString(),
					revoked: false,
				},
			]);
		}),
	);
}

describe("checkCertificate", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];

	beforeEach(() => {
		({ db } = createTestDatabase());
	});

	async function seedMonitor(overrides: Partial<InsertMonitor> = {}) {
		return unwrap(
			await bindModels(db).monitors.create({
				team_id: "team-1",
				author_id: "author-1",
				name: "Shop",
				url: "https://shop.acme-store.com",
				ssl_monitoring_enabled: true,
				ssl_expiry_source: "transparency",
				...overrides,
			}),
		);
	}

	async function run(monitorId: string) {
		let log = new Log({ kind: "job", sink: () => {} });
		let ctx = createJobContext(jobs.checkCertificate, {
			id: "message-1",
			attempts: 1,
			input: { monitorId },
			log,
		});
		ctx.set(Database, db, { property: "db" });
		publishModels(ctx, db);
		await checkCertificate(ctx);
	}

	test("fills the expiry from the logs and enqueues no alert", async () => {
		let notAfter = Date.now() + 5 * 24 * 60 * 60 * 1000;
		certSpotter(["shop.acme-store.com"], notAfter);
		let monitor = await seedMonitor();

		await run(monitor.id);

		let updated = await bindModels(db).monitors.find(monitor.id);
		expect(updated?.ssl_expires_at).toBe(notAfter);
		expect(updated?.ssl_issuer).toBe("Google Trust Services");
		expect(updated?.ssl_status).toBe("expiring");
		expect(searches[0]?.searchParams.get("domain")).toBe("shop.acme-store.com");
		expect(queue.sent).toEqual([]);
	});

	test("leaves a monitor with a typed date alone", async () => {
		let typed = Date.now() + 90 * 24 * 60 * 60 * 1000;
		let monitor = await seedMonitor({ ssl_expiry_source: "manual", ssl_expires_at: typed });

		await run(monitor.id);

		let updated = await bindModels(db).monitors.find(monitor.id);
		expect(updated?.ssl_expires_at).toBe(typed);
		expect(searches).toEqual([]);
	});

	test("does nothing for a monitor with SSL monitoring off or one that is gone", async () => {
		let monitor = await seedMonitor({ ssl_monitoring_enabled: false });

		await run(monitor.id);
		await run("missing-monitor");

		expect(searches).toEqual([]);
	});
});
