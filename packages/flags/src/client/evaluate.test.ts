/**
 * The eight evaluation methods and the one evaluation behind them: what the
 * details carry, what happens when nothing works, and what a structure is
 * checked against before it is handed back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { ResolutionDetails } from "../core/details.js";
import type { FlagValue } from "../core/value.js";

import { failed, resolved } from "../provider/details.js";
import { ProviderError } from "../provider/error.js";

import { createFlags } from "./registry.js";

/** Answers from a flag set, with the metadata and variant a real backend would attach. */
class Fake {
	readonly metadata = { name: "fake" };

	values: Record<string, FlagValue>;

	constructor(values: Record<string, FlagValue> = {}) {
		this.values = values;
	}

	answer<T extends FlagValue>(key: string, defaultValue: T): ResolutionDetails<T> {
		if (!(key in this.values)) {
			return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named ${key}`);
		}

		return resolved(this.values[key] as T, {
			variant: "on",
			reason: "TARGETING_MATCH",
			flagMetadata: { flagSetId: "checkout", version: "3" },
		});
	}

	resolveBoolean(key: string, defaultValue: boolean) {
		return this.answer(key, defaultValue);
	}
	resolveString(key: string, defaultValue: string) {
		return this.answer(key, defaultValue);
	}
	resolveNumber(key: string, defaultValue: number) {
		return this.answer(key, defaultValue);
	}
	resolveObject(key: string, defaultValue: JSONValue) {
		return this.answer(key, defaultValue);
	}
}

/** Every resolver throws, which no client method is allowed to pass on. */
class Exploding {
	readonly metadata = { name: "exploding" };

	#error: unknown;

	constructor(error: unknown) {
		this.#error = error;
	}

	resolveBoolean(): never {
		throw this.#error;
	}
	resolveString(): never {
		throw this.#error;
	}
	resolveNumber(): never {
		throw this.#error;
	}
	resolveObject(): never {
		throw this.#error;
	}
}

const Copy = s.object({ title: s.string(), cta: s.string() });

async function withProvider(values: Record<string, FlagValue> = {}) {
	let flags = createFlags();
	await flags.setProvider(new Fake(values));
	return flags.getClient();
}

describe("flag evaluation", () => {
	test("Requirement 1.3.1.1: boolean, string, number and structure each evaluate to a value", async () => {
		let client = await withProvider({
			bool: true,
			text: "hello",
			count: 42,
			copy: { title: "Checkout", cta: "Pay" },
		});

		expect(await client.boolean("bool", false)).toBe(true);
		expect(await client.string("text", "fallback")).toBe("hello");
		expect(await client.number("count", 0)).toBe(42);
		expect(await client.object("copy", { title: "", cta: "" }, { schema: Copy })).toEqual({
			title: "Checkout",
			cta: "Pay",
		});
	});

	test("Requirement 1.4.1.1: the detailed methods answer with an evaluation details structure", async () => {
		let client = await withProvider({
			bool: true,
			text: "hi",
			count: 1,
			copy: { title: "a", cta: "b" },
		});

		expect(await client.booleanDetails("bool", false)).toMatchObject({
			flagKey: "bool",
			value: true,
		});
		expect(await client.stringDetails("text", "")).toMatchObject({ flagKey: "text", value: "hi" });
		expect(await client.numberDetails("count", 0)).toMatchObject({ flagKey: "count", value: 1 });
		expect(
			await client.objectDetails("copy", { title: "", cta: "" }, { schema: Copy }),
		).toMatchObject({ flagKey: "copy", value: { title: "a", cta: "b" } });
	});

	test("Requirement 1.4.3: the details carry the evaluated value", async () => {
		let client = await withProvider({ bool: true });

		expect((await client.booleanDetails("bool", false)).value).toBe(true);
	});

	test("Requirement 1.4.5: the details carry the flag key that was asked for", async () => {
		let client = await withProvider({ bool: true });

		expect((await client.booleanDetails("bool", false)).flagKey).toBe("bool");
	});

	test("Requirement 1.4.6: the details carry the variant the provider set", async () => {
		let client = await withProvider({ bool: true });

		expect((await client.booleanDetails("bool", false)).variant).toBe("on");
	});

	test("Requirement 1.4.7: the details carry the reason the provider set", async () => {
		let client = await withProvider({ bool: true });

		expect((await client.booleanDetails("bool", false)).reason).toBe("TARGETING_MATCH");
	});

	test("Requirement 1.4.8: an abnormal evaluation carries an error code", async () => {
		let client = await withProvider();

		expect(await client.booleanDetails("missing", false)).toMatchObject({
			value: false,
			reason: "ERROR",
			errorCode: "FLAG_NOT_FOUND",
			errorMessage: "No flag named missing",
		});
	});

	test("Requirement 1.4.10: no evaluation method throws, and each answers with the default value", async () => {
		let flags = createFlags();
		await flags.setProvider(new Exploding(new Error("the backend is gone")));
		let client = flags.getClient();

		expect(await client.boolean("flag", true)).toBe(true);
		expect(await client.string("flag", "fallback")).toBe("fallback");
		expect(await client.number("flag", 7)).toBe(7);
		expect(await client.object("flag", { title: "t", cta: "c" }, { schema: Copy })).toEqual({
			title: "t",
			cta: "c",
		});
		expect(await client.booleanDetails("flag", true)).toMatchObject({
			value: true,
			reason: "ERROR",
			errorCode: "GENERAL",
			errorMessage: "the backend is gone",
		});
	});

	test("Requirement 1.4.14: flag metadata passes through, and is an empty record when absent", async () => {
		let client = await withProvider({ bool: true });

		expect((await client.booleanDetails("bool", false)).flagMetadata).toEqual({
			flagSetId: "checkout",
			version: "3",
		});
		expect((await client.booleanDetails("missing", false)).flagMetadata).toEqual({});
	});

	test("Requirement 1.4.15.1: flag metadata on the details is immutable", async () => {
		let client = await withProvider({ bool: true });
		let details = await client.booleanDetails("bool", false);

		expect(Object.isFrozen(details.flagMetadata)).toBe(true);
	});

	test("Requirement 1.5.1: invocation hooks run for that evaluation on top of the configured ones", async () => {
		let stages: string[] = [];
		let flags = createFlags({ hooks: [{ before: () => void stages.push("api") }] });
		await flags.setProvider(new Fake({ bool: true }));

		await flags.getClient().boolean("bool", false, undefined, {
			hooks: [{ before: () => void stages.push("invocation") }],
		});
		await flags.getClient().boolean("bool", false);

		expect(stages).toEqual(["api", "invocation", "api"]);
	});

	test("a provider error code survives a resolver that throws", async () => {
		let flags = createFlags();
		await flags.setProvider(new Exploding(new ProviderError("PARSE_ERROR", "unreadable rule set")));

		expect(await flags.getClient().booleanDetails("flag", false)).toMatchObject({
			errorCode: "PARSE_ERROR",
			errorMessage: "unreadable rule set",
			reason: "ERROR",
		});
	});
});

describe("type checking", () => {
	test("Requirement 1.3.4: a value of the wrong primitive type is a type mismatch", async () => {
		let client = await withProvider({ bool: "yes", count: "many" });

		expect(await client.booleanDetails("bool", false)).toMatchObject({
			value: false,
			reason: "ERROR",
			errorCode: "TYPE_MISMATCH",
		});
		expect(await client.number("count", 5)).toBe(5);
	});

	test("Requirement 1.3.4: a structure is validated against its schema", async () => {
		let client = await withProvider({ copy: { title: "Checkout", cta: "Pay" } });

		expect(await client.object("copy", { title: "", cta: "" }, { schema: Copy })).toEqual({
			title: "Checkout",
			cta: "Pay",
		});
	});

	test("Requirement 1.3.4: a structure that fails its schema is a type mismatch", async () => {
		let client = await withProvider({ copy: { title: "Checkout" } });

		expect(
			await client.objectDetails("copy", { title: "t", cta: "c" }, { schema: Copy }),
		).toMatchObject({
			value: { title: "t", cta: "c" },
			reason: "ERROR",
			errorCode: "TYPE_MISMATCH",
		});
	});
});

describe("the catalog methods", () => {
	test("get unpacks a flag handle into the key, the type and the default", async () => {
		let client = await withProvider({ "new-checkout": true });

		expect(await client.get({ key: "new-checkout", type: "boolean", defaultValue: false })).toBe(
			true,
		);
		expect(await client.get({ key: "absent", type: "boolean", defaultValue: false })).toBe(false);
	});

	test("get takes a default value and a context for one call", async () => {
		let client = await withProvider();

		expect(
			await client.get(
				{ key: "absent", type: "boolean", defaultValue: false },
				{ defaultValue: true, context: { targetingKey: "user-1" } },
			),
		).toBe(true);
	});

	test("details unpacks the same handle and answers with the details", async () => {
		let client = await withProvider({ copy: { title: "a", cta: "b" } });

		expect(
			await client.details({
				key: "copy",
				type: "object",
				defaultValue: { title: "", cta: "" },
				schema: Copy,
			}),
		).toMatchObject({ flagKey: "copy", value: { title: "a", cta: "b" } });
	});
});
