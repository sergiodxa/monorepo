/**
 * Tests the job adapter with the flag fact source: `ctx.authz` binds a job's
 * subject over the shared sources, and only the flags a condition reads are
 * evaluated, through the delivery's own flags client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext } from "@sdxc/jobs";

import { defineFlags, flag } from "@sdxc/flags/catalog";
import { createFlags } from "@sdxc/flags/client";
import featureFlags from "@sdxc/flags/middleware/dispatcher";
import { InMemoryProvider } from "@sdxc/flags/provider/memory";
import { createJobContext, job, jobs } from "@sdxc/jobs";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { abilities, ability } from "../catalog.js";
import { fromFlags } from "../facts/flags.js";
import { allow, deny, fact } from "../grants.js";
import { definePolicy } from "../policy.js";

import type { Authz } from "./dispatcher.js";

import { authz } from "./dispatcher.js";

const FEATURES = defineFlags({
	reportsExport: flag.boolean("reports-export", true),
	newCheckout: flag.boolean("new-checkout", false),
});

const CATALOG = abilities({ reports: { export: ability() } });

const POLICY = definePolicy(CATALOG, {
	facts: { flags: fact<{ reportsExport: boolean }>() },
	roles: { member: [allow("reports")] },
	guards: [
		deny("reports.export", {
			id: "reports-switch",
			when: { op: "eq", field: "flags.reportsExport", value: false },
			reason: "switched-off",
		}),
	],
});

const QUEUE = jobs({ exportReport: job() });

/** A flags registry answering `reports-export` as given, recording every key evaluated. */
function registry(reportsExport: boolean) {
	let evaluated: string[] = [];
	let provider = new InMemoryProvider({
		"reports-export": {
			variants: { on: true, off: false },
			defaultVariant: reportsExport ? "on" : "off",
			contextEvaluator: () => {
				evaluated.push("reports-export");
				return undefined;
			},
		},
		"new-checkout": {
			variants: { on: true, off: false },
			defaultVariant: "on",
			contextEvaluator: () => {
				evaluated.push("new-checkout");
				return undefined;
			},
		},
	});
	return { flags: createFlags({ provider: () => provider }), evaluated };
}

/** Runs a delivery through `featureFlags` and `authz`, handing the handler its binder. */
async function deliver(reportsExport: boolean, handler: (binder: Authz) => Promise<void>) {
	let { flags, evaluated } = registry(reportsExport);
	let ctx: AnyJobContext = createJobContext(QUEUE.exportReport, { id: "message-1", attempts: 1 });

	await featureFlags(flags)(ctx, async () =>
		authz(POLICY, { facts: { flags: fromFlags(FEATURES) } })(ctx, async () =>
			handler((ctx as AnyJobContext & { authz: Authz }).authz),
		),
	);
	return evaluated;
}

describe("authz dispatcher middleware", () => {
	test("binds a job's subject over the shared flag facts", async () => {
		let answers: boolean[] = [];

		for (let on of [true, false]) {
			await deliver(on, async (binder) => {
				let access = unwrap(binder.for({ roles: ["member"] }));
				await access.load(CATALOG.reports);
				answers.push(access.can(CATALOG.reports.export));
			});
		}

		expect(answers).toEqual([true, false]);
	});

	test("evaluates only the flags some condition reads", async () => {
		let evaluated = await deliver(true, async (binder) => {
			let access = unwrap(binder.for({ roles: ["member"] }));
			await access.load(CATALOG.reports);
		});

		expect(evaluated).toEqual(["reports-export"]);
	});

	test("lets a binding replace a shared fact", async () => {
		await deliver(true, async (binder) => {
			let access = unwrap(
				binder.for({ roles: ["member"], facts: { flags: { reportsExport: false } } }),
			);
			expect(access.check(CATALOG.reports.export)).toMatchObject({ reason: "switched-off" });
		});
	});

	test("refuses with cause error when no flags client was installed", async () => {
		let ctx: AnyJobContext = createJobContext(QUEUE.exportReport, { id: "message-2", attempts: 1 });

		await authz(POLICY, { facts: { flags: fromFlags(FEATURES) } })(ctx, async () => {
			let access = unwrap(
				(ctx as AnyJobContext & { authz: Authz }).authz.for({ roles: ["member"] }),
			);
			await access.load(CATALOG.reports);
			expect(access.check(CATALOG.reports.export)).toMatchObject({ cause: "error" });
		});
	});
});
