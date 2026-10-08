/**
 * Tests entitlements as facts: a plan guard reads the billing middleware's
 * snapshot through the request's one read, a free account answers `false`
 * without failing, and an outage refuses only plan-gated abilities.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementSnapshot } from "@sdxc/billing/middleware";

import billing, { requireEntitlement } from "@sdxc/billing/middleware";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import { abilities, ability } from "../catalog.js";
import { allow, deny, fact } from "../grants.js";
import { access } from "../middleware/router.js";
import { definePolicy } from "../policy.js";

import { fromEntitlements } from "./billing.js";

const CATALOG = abilities({ reports: { export: ability() }, profile: { read: ability() } });

const POLICY = definePolicy(CATALOG, {
	facts: { billing: fact<{ products: string[]; features: string[] }>() },
	roles: { member: [allow("*")] },
	guards: [
		deny("reports.export", {
			id: "plan-reports",
			when: { op: "not", of: { op: "includes", field: "billing.features", value: "reports" } },
			reason: "entitlement:reports",
		}),
	],
});

/** Runs billing, then access, answering what the handler decided. */
async function decide(
	read: () => EntitlementSnapshot | null | Promise<EntitlementSnapshot | null>,
	inner?: (ctx: RequestContext) => Response | Promise<Response>,
) {
	let ctx = new RequestContext(new Request("https://example.com/reports"));
	let answers: Record<string, unknown> = {};
	await billing({ provider: new MemoryBilling(), entitlements: read })(ctx, async () =>
		access(POLICY, { roles: ["member"], facts: { billing: fromEntitlements() } })(ctx, async () => {
			await ctx.access.load(CATALOG);
			answers.export = ctx.access.check(CATALOG.reports.export);
			answers.profile = ctx.access.can(CATALOG.profile.read);
			return inner ? inner(ctx) : new Response("ok");
		}),
	);
	return answers;
}

describe("fromEntitlements", () => {
	test("allows what the snapshot grants", async () => {
		let answers = await decide(() => ({ products: ["pro"], features: { reports: true } }));

		expect(answers.export).toMatchObject({ allowed: true });
	});

	test("refuses a free account with the guard's reason, never an error", async () => {
		expect((await decide(() => null)).export).toMatchObject({
			cause: "denied",
			reason: "entitlement:reports",
		});
		expect(
			(await decide(() => ({ products: [], features: { reports: false } }))).export,
		).toMatchObject({
			cause: "denied",
		});
	});

	test("refuses only plan-gated abilities during an outage", async () => {
		let answers = await decide(async () => {
			throw new Error("database unavailable");
		});

		expect(answers.export).toMatchObject({ cause: "error" });
		expect(answers.profile).toBe(true);
	});

	test("shares the request's one read with requireEntitlement", async () => {
		let reads = 0;
		await decide(
			() => {
				reads += 1;
				return { products: ["pro"], features: { reports: true } };
			},
			(ctx) => requireEntitlement("reports")(ctx, async () => new Response("ok")),
		);

		expect(reads).toBe(1);
	});
});
