/**
 * Tests the job side: the middleware initializes the registry once per isolate,
 * builds the delivery's context from what earlier middleware published, and
 * installs a client a job handler evaluates through as `ctx.flags`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext } from "@sdxc/jobs";

import { createJobContext, job, jobs } from "@sdxc/jobs";
import { createContextKey } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { Client } from "../core/client.js";
import type { EvaluationContext } from "../core/context.js";

import { createFlags } from "../client/registry.js";
import { InMemoryProvider } from "../provider/memory.js";

import featureFlags from "./dispatcher.js";

import { Flags } from "./index.js";

const Team = createContextKey<{ id: string }>();

const catalog = jobs({ sendWeeklyDigest: job() });

/** A provider recording every context targeting was asked about. */
function recording() {
	let contexts: EvaluationContext[] = [];

	let provider = new InMemoryProvider({
		"weekly-digest-v2": {
			variants: { on: true, off: false },
			defaultVariant: "off",
			contextEvaluator(context) {
				contexts.push(context);
				return context.targetingKey === "team-1" ? "on" : undefined;
			},
		},
	});

	return { provider, contexts };
}

/** The delivery a middleware is driven against, with no dispatcher involved. */
function delivery(): AnyJobContext {
	let ctx = createJobContext(catalog.sendWeeklyDigest, { id: "message-1", attempts: 1 });
	ctx.set(Team, { id: "team-1" });
	return ctx;
}

/** What a handler behind the middleware sees once the effect has been applied. */
function client(ctx: AnyJobContext): Client {
	return (ctx as AnyJobContext & { flags: Client }).flags;
}

describe("dispatcher middleware", () => {
	test("installs a client a handler evaluates through as ctx.flags", async () => {
		let { provider } = recording();
		let flags = createFlags({ provider: () => provider });
		let ctx = delivery();
		let sent: string | undefined;

		await featureFlags(flags)(ctx, async () => {
			sent = (await client(ctx).boolean("weekly-digest-v2", false)) ? "v2" : "v1";
		});

		expect(sent).toBe("v1");
	});

	test("hands the context callback's fields to the provider", async () => {
		let { provider, contexts } = recording();
		let flags = createFlags({ provider: () => provider });
		let ctx = delivery();
		let sent: string | undefined;

		await featureFlags(flags, { context: (current) => ({ targetingKey: current.get(Team)?.id }) })(
			ctx,
			async () => {
				sent = (await client(ctx).boolean("weekly-digest-v2", false)) ? "v2" : "v1";
			},
		);

		expect(sent).toBe("v2");
		expect(contexts).toHaveLength(1);
		expect(contexts[0]).toMatchObject({ targetingKey: "team-1" });
	});

	test("awaits initialization before the first evaluation, and once per isolate", async () => {
		let { provider } = recording();
		let initialize = vi.spyOn(provider, "initialize");
		let flags = createFlags({ provider: () => provider });
		let middleware = featureFlags(flags);
		let reasons: (string | undefined)[] = [];

		for (let attempt of [1, 2]) {
			let ctx = createJobContext(catalog.sendWeeklyDigest, { id: "message-1", attempts: attempt });
			await middleware(ctx, async () => {
				let details = await client(ctx).booleanDetails("weekly-digest-v2", true);
				reasons.push(details.reason);
			});
		}

		expect(reasons).toEqual(["DEFAULT", "DEFAULT"]);
		expect(initialize).toHaveBeenCalledTimes(1);
	});

	test("publishes the same client under the shared Flags key", async () => {
		let { provider } = recording();
		let flags = createFlags({ provider: () => provider });
		let ctx = delivery();

		await featureFlags(flags)(ctx, async () => {});

		expect(ctx.get(Flags)).toBe(client(ctx));
	});
});
