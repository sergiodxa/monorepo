/**
 * The catalog: what a handle carries, what `defineFlags` keeps, and what the
 * client makes of a handle it is handed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { Client } from "../core/client.js";

import { createFlags } from "../client/registry.js";
import { InMemoryProvider } from "../provider/memory.js";

import { defineFlags, flag } from "./index.js";

const Copy = s.object({ title: s.string(), cta: s.string() });

type CopyValue = StandardSchemaV1.InferOutput<typeof Copy>;

const features = defineFlags({
	newCheckout: flag.boolean("new-checkout", false),
	digestSubject: flag.string("digest-subject", "Your digest"),
	digestBatch: flag.number("digest-batch-size", 50),
	checkoutCopy: flag.object("checkout-copy", Copy, { title: "Checkout", cta: "Pay" }),
});

async function withFlags(provider: InMemoryProvider): Promise<Client> {
	let flags = createFlags();
	await flags.setProvider(provider);
	return flags.getClient();
}

describe("the handle constructors", () => {
	test("each carries the key, the type and the default", () => {
		expect(flag.boolean("new-checkout", false)).toEqual({
			key: "new-checkout",
			type: "boolean",
			defaultValue: false,
		});
		expect(flag.string("digest-subject", "Your digest")).toEqual({
			key: "digest-subject",
			type: "string",
			defaultValue: "Your digest",
		});
		expect(flag.number("digest-batch-size", 50)).toEqual({
			key: "digest-batch-size",
			type: "number",
			defaultValue: 50,
		});
	});

	test("a structure carries the schema its value is checked against", () => {
		expect(flag.object("checkout-copy", Copy, { title: "Checkout", cta: "Pay" })).toEqual({
			key: "checkout-copy",
			type: "object",
			defaultValue: { title: "Checkout", cta: "Pay" },
			schema: Copy,
		});
	});
});

describe("defineFlags", () => {
	test("hands back every handle it was given", () => {
		let newCheckout = flag.boolean("new-checkout", false);
		let declared = defineFlags({ newCheckout });

		expect(declared.newCheckout).toBe(newCheckout);
		expect(Object.keys(declared)).toEqual(["newCheckout"]);
	});
});

describe("evaluating a handle", () => {
	test("get answers with the value the provider serves", async () => {
		let client = await withFlags(
			new InMemoryProvider({
				"new-checkout": { variants: { on: true, off: false }, defaultVariant: "on" },
				"digest-batch-size": { variants: { large: 500 }, defaultVariant: "large" },
				"checkout-copy": {
					variants: { short: { title: "Pay now", cta: "Go" } },
					defaultVariant: "short",
				},
			}),
		);

		expect(await client.get(features.newCheckout)).toBe(true);
		expect(await client.get(features.digestBatch)).toBe(500);
		expect(await client.get(features.checkoutCopy)).toEqual({ title: "Pay now", cta: "Go" });
	});

	test("details carries the reason and the variant alongside the value", async () => {
		let client = await withFlags(
			new InMemoryProvider({
				"new-checkout": { variants: { on: true, off: false }, defaultVariant: "on" },
			}),
		);

		expect(await client.details(features.newCheckout)).toMatchObject({
			flagKey: "new-checkout",
			value: true,
			variant: "on",
			reason: "STATIC",
		});
	});

	test("the catalog default answers for a flag the provider does not have", async () => {
		let client = await withFlags(new InMemoryProvider());

		expect(await client.details(features.digestSubject)).toMatchObject({
			value: "Your digest",
			reason: "ERROR",
			errorCode: "FLAG_NOT_FOUND",
		});
	});
});

describe("the options bag", () => {
	test("a default given at the call site stands in for that call alone", async () => {
		let client = await withFlags(new InMemoryProvider());

		expect(await client.get(features.newCheckout, { defaultValue: true })).toBe(true);
		expect(await client.get(features.newCheckout)).toBe(false);
	});

	test("the context reaches the provider's targeting", async () => {
		let client = await withFlags(
			new InMemoryProvider({
				"new-checkout": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					contextEvaluator: (context) => (context.targetingKey === "team-1" ? "on" : undefined),
				},
			}),
		);

		expect(await client.get(features.newCheckout, { context: { targetingKey: "team-1" } })).toBe(
			true,
		);
		expect(await client.get(features.newCheckout, { context: { targetingKey: "team-2" } })).toBe(
			false,
		);
	});
});

describe("a structure the schema rejects", () => {
	test("is a type mismatch answered with the catalog default", async () => {
		let client = await withFlags(
			new InMemoryProvider({
				"checkout-copy": { variants: { partial: { title: "Pay now" } }, defaultVariant: "partial" },
			}),
		);

		expect(await client.details(features.checkoutCopy)).toMatchObject({
			value: { title: "Checkout", cta: "Pay" },
			reason: "ERROR",
			errorCode: "TYPE_MISMATCH",
		});
	});
});

describe("inference at the call site", () => {
	test("a handle types the evaluation it is passed to", async () => {
		let client = await withFlags(new InMemoryProvider());

		expectTypeOf(client.get(features.newCheckout)).toEqualTypeOf<Promise<boolean>>();
		expectTypeOf(client.get(features.digestSubject)).toEqualTypeOf<Promise<string>>();
		expectTypeOf(client.get(features.digestBatch)).toEqualTypeOf<Promise<number>>();
		expectTypeOf(client.get(features.checkoutCopy)).toEqualTypeOf<Promise<CopyValue>>();
		expectTypeOf<CopyValue>().toEqualTypeOf<{ title: string; cta: string }>();

		expectTypeOf(client.details(features.newCheckout)).resolves.toExtend<{ value: boolean }>();
	});

	test("a default of another type is not expressible", async () => {
		let client = await withFlags(new InMemoryProvider());

		// @ts-expect-error a string cannot stand in for a boolean flag's default
		await client.get(features.newCheckout, { defaultValue: "yes" });
		// @ts-expect-error the structure has to satisfy the flag's schema
		await client.get(features.checkoutCopy, { defaultValue: { title: "Checkout" } });
	});

	test("a structure default the schema would reject is a compile error", () => {
		// @ts-expect-error the default is missing the `cta` the schema requires
		flag.object("checkout-copy", Copy, { title: "Checkout" });
	});
});
