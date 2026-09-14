/**
 * Tests the request side: the middleware initializes the registry once per
 * isolate, builds the request's context, and publishes a client a route handler
 * evaluates through as `ctx.flags`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { EvaluationContext } from "../core/context.js";

import { createFlags } from "../client/registry.js";
import { InMemoryProvider } from "../provider/memory.js";

import featureFlags from "./router.js";

import { Flags } from "./index.js";

/** A provider recording every context targeting was asked about. */
function recording() {
	let contexts: EvaluationContext[] = [];

	let provider = new InMemoryProvider({
		"new-checkout": {
			variants: { on: true, off: false },
			defaultVariant: "off",
			contextEvaluator(context) {
				contexts.push(context);
				return context.targetingKey === "user-1" ? "on" : undefined;
			},
		},
	});

	return { provider, contexts };
}

describe("router middleware", () => {
	test("publishes a client a handler evaluates through as ctx.flags", async () => {
		let { provider } = recording();
		let flags = createFlags({ provider: () => provider });

		let router = createRouter({ middleware: [featureFlags(flags)] });
		router.get("/checkout", async (ctx) => {
			if (await ctx.flags.boolean("new-checkout", false)) return new Response("new");
			return new Response("old");
		});

		let response = await router.fetch(new Request("https://example.com/checkout"));

		expect(await response.text()).toBe("old");
	});

	test("hands the context callback's fields to the provider", async () => {
		let { provider, contexts } = recording();
		let flags = createFlags({ provider: () => provider });

		let router = createRouter({
			middleware: [
				featureFlags(flags, {
					context(ctx) {
						return { targetingKey: ctx.request.headers.get("x-user") ?? undefined, country: "AR" };
					},
				}),
			],
		});
		router.get("/checkout", async (ctx) => {
			return new Response(String(await ctx.flags.boolean("new-checkout", false)));
		});

		let response = await router.fetch(
			new Request("https://example.com/checkout", { headers: { "x-user": "user-1" } }),
		);

		expect(await response.text()).toBe("true");
		expect(contexts).toHaveLength(1);
		expect(contexts[0]).toMatchObject({ targetingKey: "user-1", country: "AR" });
	});

	test("awaits initialization before the first evaluation, and once per isolate", async () => {
		let { provider } = recording();
		let initialize = vi.spyOn(provider, "initialize");
		let flags = createFlags({ provider: () => provider });

		let router = createRouter({ middleware: [featureFlags(flags)] });
		router.get("/checkout", async (ctx) => {
			let details = await ctx.flags.booleanDetails("new-checkout", true);
			return Response.json({ reason: details.reason, errorCode: details.errorCode });
		});

		let first = await (await router.fetch(new Request("https://example.com/checkout"))).json();
		await router.fetch(new Request("https://example.com/checkout"));

		expect(first).toEqual({ reason: "DEFAULT", errorCode: undefined });
		expect(initialize).toHaveBeenCalledTimes(1);
	});

	test("evaluates through the provider bound to the configured domain", async () => {
		let flags = createFlags({ provider: () => new InMemoryProvider() });
		await flags.setProvider(
			"marketing",
			new InMemoryProvider({
				"new-checkout": { variants: { on: true }, defaultVariant: "on" },
			}),
		);

		let router = createRouter({ middleware: [featureFlags(flags, { domain: "marketing" })] });
		router.get("/checkout", async (ctx) => {
			return new Response(String(await ctx.flags.boolean("new-checkout", false)));
		});

		let response = await router.fetch(new Request("https://example.com/checkout"));

		expect(await response.text()).toBe("true");
	});

	test("publishes the same client under the shared Flags key", async () => {
		let { provider } = recording();
		let flags = createFlags({ provider: () => provider });

		let router = createRouter({ middleware: [featureFlags(flags)] });
		router.get("/checkout", (ctx) => {
			return new Response(String(ctx.get(Flags) === ctx.flags));
		});

		let response = await router.fetch(new Request("https://example.com/checkout"));

		expect(await response.text()).toBe("true");
	});
});
