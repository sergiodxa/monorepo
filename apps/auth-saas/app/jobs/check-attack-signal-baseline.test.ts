/**
 * Exercises the `checkAttackSignalBaseline` cron: it walks every provisioned
 * tenant, skips one already alerted today before reading anything, compares its
 * last hour of failed sign-ins to its own trailing week, and mails every owner
 * once when that hour stands well above baseline, recording the day's alert only
 * once a send actually goes out. `readFailedSignInsByHour` is mocked rather than
 * hit over HTTP, the way `sweep-due-webhook-deliveries.test.ts` mocks the queue
 * binding rather than the tenant object's own storage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createDurableObjectNamespace, createEnv } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { FailedSignInsByHour, ReadFailedSignInsByHourInput } from "~/app/lib/attack-signals";
import type { Models } from "~/app/models";
import type Tenant from "~/database/tenant-do";

/** One hour, matching the job's own recent-window span. */
const HOUR_MS = 60 * 60 * 1000;

/**
 * The platform's own tenant hostname, the name its dashboard subjects live under.
 * Fixed to the app's own configured `PLATFORM_DOMAIN`, since `wrangler.jsonc`
 * pins that var to a literal type `createEnv` must match.
 */
const PLATFORM_DOMAIN = "auth.sergiodxa.com";

let readFailedSignInsByHour = vi.fn(
	async (
		_engine: unknown,
		_input: ReadFailedSignInsByHourInput,
	): Promise<FailedSignInsByHour[]> => [],
);

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		PLATFORM_DOMAIN,
		CF_ACCOUNT_ID: "acct_1",
		CF_API_TOKEN: "test-cf-token",
		EMAIL_FROM: "Auth SaaS <noreply@auth.sergiodxa.com>",
	}),
}));

vi.doMock("~/app/lib/attack-signals", async (importOriginal) => {
	let actual = await importOriginal<typeof import("~/app/lib/attack-signals")>();
	return { ...actual, readFailedSignInsByHour };
});

let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { Mail } = await import("~/app/jobs/middleware/mail");
let { TenantNamespace } = await import("~/app/jobs/middleware/tenant");
let { createTestDatabase } = await import("~/app/test/db");
let { bindModels, publishModels } = await import("~/app/test/models");
let { dayOf } = await import("~/database/metering");
let checkAttackSignalBaseline = (await import("./check-attack-signal-baseline")).default;

let db: Database;
let models: Models;
let transport: MemoryTransport;

beforeEach(async () => {
	readFailedSignInsByHour.mockReset();
	readFailedSignInsByHour.mockResolvedValue([]);
	db = await createTestDatabase();
	models = bindModels(db);
	transport = new MemoryTransport();
});

/** Creates a provisioned tenant row in the control plane. */
async function makeTenant(name: string) {
	let customer = unwrap(await models.customers.create({ name }));
	return unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name,
			slug: name.toLowerCase(),
			issuer: `https://${name.toLowerCase()}.example.com`,
		}),
	);
}

/**
 * Points `readFailedSignInsByHour` at one tenant's own canned rows, answering the
 * recent hour or the trailing week by the span the job actually asked for.
 */
function stubSignals(
	tenantId: string,
	rows: { recent: FailedSignInsByHour[]; baseline: FailedSignInsByHour[] },
): void {
	readFailedSignInsByHour.mockImplementation(async (_engine, input) => {
		if (input.tenantId !== tenantId) return [];
		return input.to - input.from <= HOUR_MS ? rows.recent : rows.baseline;
	});
}

/** Builds the platform tenant's own DO stub, answering `describeSubject` for every registered owner. */
function makePlatformNamespace(emailsBySubject: Record<string, string>) {
	return createDurableObjectNamespace<Tenant>((name) => {
		if (name !== PLATFORM_DOMAIN) return {};

		return {
			describeSubject: async (input: { subjectId: string }) => {
				let email = emailsBySubject[input.subjectId];
				if (!email) return { ok: false, reason: "not-found" };

				return {
					ok: true,
					identifiers: [
						{ kind: "email", value: email, verified: true, verifiedAt: 1, isPrimary: true },
					],
				};
			},
		};
	});
}

/** Builds the context the handler receives, wired to the control-plane `db` and a recording mailer. */
function makeContext(namespace: ReturnType<typeof makePlatformNamespace>) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.checkAttackSignalBaseline, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, db, { property: "database" });
	publishModels(ctx, db);
	ctx.set(TenantNamespace, namespace, { property: "tenant" });
	ctx.set(
		Mail,
		new Mailer({ transport, from: { email: "noreply@auth.example.com", name: "Auth SaaS" } }),
		{ property: "mail" },
	);

	return {
		ctx,
		emit: () => {
			log.emit();
			return record;
		},
	};
}

describe("checkAttackSignalBaseline", () => {
	test("mails every owner when the recent rate stands well above baseline, and records the day's alert", async () => {
		let tenant = await makeTenant("Acme");
		unwrap(
			await models.memberships.create({
				tenant_id: tenant.id,
				subject_id: "sub_owner",
				role: "owner",
			}),
		);
		unwrap(
			await models.memberships.create({
				tenant_id: tenant.id,
				subject_id: "sub_admin",
				role: "admin",
			}),
		);

		stubSignals(tenant.id, {
			recent: [{ hour: "2026-09-22 14:00:00", count: 10 }],
			baseline: [{ hour: "2026-09-15 14:00:00", count: 7 }],
		});

		let namespace = makePlatformNamespace({ sub_owner: "owner@acme.example.com" });
		let { ctx, emit } = makeContext(namespace);

		await checkAttackSignalBaseline(ctx);

		expect(transport.messages).toHaveLength(1);
		expect(transport.messages[0]?.to).toEqual([{ email: "owner@acme.example.com" }]);
		expect(transport.messages[0]?.subject).toContain("Acme");

		let today = dayOf(Date.now());
		let alert = await models.attackSignalAlerts.find({ tenant_id: tenant.id, day: today });
		expect(alert).not.toBeNull();

		expect(emit()).toMatchObject({ "alerts.sent": 1 });
	});

	test("skips a tenant already alerted today even though it is genuinely elevated", async () => {
		let tenant = await makeTenant("Acme");
		unwrap(
			await models.memberships.create({
				tenant_id: tenant.id,
				subject_id: "sub_owner",
				role: "owner",
			}),
		);

		let today = dayOf(Date.now());
		unwrap(await models.attackSignalAlerts.create({ tenant_id: tenant.id, day: today }));

		stubSignals(tenant.id, {
			recent: [{ hour: "2026-09-22 14:00:00", count: 999 }],
			baseline: [{ hour: "2026-09-15 14:00:00", count: 1 }],
		});

		let namespace = makePlatformNamespace({ sub_owner: "owner@acme.example.com" });
		let { ctx } = makeContext(namespace);

		await checkAttackSignalBaseline(ctx);

		expect(transport.messages).toHaveLength(0);
		expect(readFailedSignInsByHour).not.toHaveBeenCalled();
	});

	test("does not mail or record an alert when the recent rate is not elevated", async () => {
		let tenant = await makeTenant("Acme");
		unwrap(
			await models.memberships.create({
				tenant_id: tenant.id,
				subject_id: "sub_owner",
				role: "owner",
			}),
		);

		stubSignals(tenant.id, {
			recent: [{ hour: "2026-09-22 14:00:00", count: 2 }],
			baseline: [{ hour: "2026-09-15 14:00:00", count: 100 }],
		});

		let namespace = makePlatformNamespace({ sub_owner: "owner@acme.example.com" });
		let { ctx } = makeContext(namespace);

		await checkAttackSignalBaseline(ctx);

		expect(transport.messages).toHaveLength(0);

		let today = dayOf(Date.now());
		let alert = await models.attackSignalAlerts.find({ tenant_id: tenant.id, day: today });
		expect(alert).toBeNull();
	});

	test("visits every provisioned tenant, mailing only the one that is elevated", async () => {
		let elevated = await makeTenant("Acme");
		let quiet = await makeTenant("Bristle");
		unwrap(
			await models.memberships.create({
				tenant_id: elevated.id,
				subject_id: "sub_elevated_owner",
				role: "owner",
			}),
		);
		unwrap(
			await models.memberships.create({
				tenant_id: quiet.id,
				subject_id: "sub_quiet_owner",
				role: "owner",
			}),
		);

		readFailedSignInsByHour.mockImplementation(async (_engine, input) => {
			let isRecent = input.to - input.from <= HOUR_MS;
			if (input.tenantId === elevated.id) {
				return isRecent ? [{ hour: "h", count: 10 }] : [{ hour: "h", count: 7 }];
			}
			return isRecent ? [{ hour: "h", count: 1 }] : [{ hour: "h", count: 100 }];
		});

		let namespace = makePlatformNamespace({
			sub_elevated_owner: "owner@acme.example.com",
			sub_quiet_owner: "owner@bristle.example.com",
		});
		let { ctx, emit } = makeContext(namespace);

		await checkAttackSignalBaseline(ctx);

		expect(transport.messages).toHaveLength(1);
		expect(transport.messages[0]?.to).toEqual([{ email: "owner@acme.example.com" }]);
		expect(emit()).toMatchObject({ "tenants.visited": 2, "tenants.checked": 2, "alerts.sent": 1 });
	});
});
