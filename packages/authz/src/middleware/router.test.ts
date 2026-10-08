/**
 * Tests the router adapter: `access` binds lazily from the request, and
 * `requireAbility` decides before the handler, publishes what it loaded, and
 * answers a missing record exactly like a hidden one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Refusal } from "../decision.js";

import { abilities, ability, context } from "../catalog.js";
import { allow, deny, fact } from "../grants.js";
import { definePolicy } from "../policy.js";

import { access, CurrentAccess, requireAbility } from "./router.js";

interface Monitor {
	id: string;
	teamId: string;
}

const CATALOG = abilities({
	monitor: {
		read: ability({ context: context<{ monitor: Monitor }>("monitor"), deniedAs: "notFound" }),
		run: ability({ context: context<{ monitor: Monitor }>("monitor") }),
	},
	reports: { export: ability() },
});

const POLICY = definePolicy(CATALOG, {
	facts: { billing: fact<{ state: string }>(), actor: fact<{ teamId: string }>() },
	roles: { member: [allow(["monitor", "reports"])] },
	guards: [
		deny("monitor", {
			id: "other-team",
			when: { op: "ne", field: "monitor.teamId", path: "actor.teamId" },
			reason: "other-team",
			as: "notFound",
		}),
		deny("monitor.run", {
			id: "subscription",
			when: { op: "eq", field: "billing.state", value: "inactive" },
			reason: "subscription-required",
		}),
	],
});

const MONITORS: Record<string, Monitor> = {
	m1: { id: "m1", teamId: "t1" },
	m2: { id: "m2", teamId: "t2" },
};

/** The handler behind every chain under test. */
async function ok(): Promise<Response> {
	return new Response("ok");
}

/** Runs `access` then `requireAbility` for a monitor, returning the response and what the handler saw. */
async function run(
	id: string,
	state = "active",
	onDenied?: (ctx: RequestContext, decision: Refusal) => Response,
) {
	let ctx = new RequestContext(new Request(`https://example.com/monitors/${id}/run`));
	let seen: Monitor | undefined;
	let response = await access(POLICY, {
		roles: () => ["member"],
		facts: { actor: { teamId: "t1" }, billing: async () => ({ state }) },
		...(onDenied === undefined ? {} : { onDenied }),
	})(ctx, async () =>
		requireAbility(CATALOG.monitor.run, {
			context: (current) => {
				let monitor = MONITORS[current.url.pathname.split("/")[2] ?? ""];
				return monitor ? { monitor } : null;
			},
		})(ctx, async () => {
			seen = ctx.get(CATALOG.monitor.run)?.monitor;
			return ok();
		}),
	);
	return { response, seen, ctx };
}

describe("access", () => {
	test("publishes ctx.access, loading nothing until a check needs it", async () => {
		let ctx = new RequestContext(new Request("https://example.com/"));
		let reads = 0;

		await access(POLICY, {
			roles: ["member"],
			facts: {
				actor: { teamId: "t1" },
				billing: () => {
					reads += 1;
					return { state: "active" };
				},
			},
		})(ctx, ok);

		expect(reads).toBe(0);
		expect(ctx.get(CurrentAccess)).toBe(ctx.access);
		await ctx.access.load(CATALOG.monitor.run);
		expect(reads).toBe(1);
	});

	test("loads the abilities it is told to before the handler runs", async () => {
		let ctx = new RequestContext(new Request("https://example.com/"));
		let answer: boolean | undefined;

		await access(POLICY, { roles: async () => ["member"], load: [CATALOG.reports] })(
			ctx,
			async () => {
				answer = ctx.access.can(CATALOG.reports.export);
				return ok();
			},
		);

		expect(answer).toBe(true);
	});

	test("answers 500 for a policy that does not compile", async () => {
		let broken = definePolicy(CATALOG, { roles: { member: [allow("nope" as "monitor")] } });
		let ctx = new RequestContext(new Request("https://example.com/"));

		expect((await access(broken)(ctx, ok)).status).toBe(500);
	});
});

describe("requireAbility", () => {
	test("admits an allowed request and publishes the loaded context under the ability", async () => {
		let { response, seen } = await run("m1");

		expect(response.status).toBe(200);
		expect(seen).toEqual(MONITORS.m1);
	});

	test("answers a missing record and another team's record alike", async () => {
		let missing = await run("m9");
		let hidden = await run("m2");

		expect(missing.response.status).toBe(404);
		expect(hidden.response.status).toBe(404);
		expect(await missing.response.text()).toBe(await hidden.response.text());
		expect(hidden.seen).toBeUndefined();
	});

	test("answers a forbidden refusal with 403 by default", async () => {
		let { response } = await run("m1", "inactive");

		expect(response.status).toBe(403);
	});

	test("hands every refusal to the access onDenied", async () => {
		let reasons: (string | undefined)[] = [];
		let onDenied = (_ctx: RequestContext, decision: Refusal) => {
			reasons.push(decision.cause === "denied" ? decision.reason : decision.as);
			return new Response(null, { status: 402 });
		};

		let { response } = await run("m1", "inactive", onDenied);
		await run("m9", "active", onDenied);

		expect(response.status).toBe(402);
		expect(reasons).toEqual(["subscription-required", "notFound"]);
	});

	test("answers 500 without an access middleware before it", async () => {
		let ctx = new RequestContext(new Request("https://example.com/"));

		expect((await requireAbility(CATALOG.reports.export)(ctx, ok)).status).toBe(500);
	});
});
