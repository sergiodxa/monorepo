/**
 * `evaluation_v2.feature`, scenario by scenario: what the four typed methods
 * resolve to, what the details carry, what an abnormal evaluation answers with,
 * and what the provider's status says about all of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { Client } from "../core/client.js";
import type { EvaluationContext } from "../core/context.js";
import type { EvaluationDetails, ResolutionDetails } from "../core/details.js";
import type { ProviderMetadata } from "../core/metadata.js";
import type { ProviderStatus } from "../core/status.js";
import type { FlagValue } from "../core/value.js";
import type { Provider } from "../provider/provider.js";

import { createFlags } from "../client/index.js";
import { ProviderEvents } from "../provider/events.js";
import { InMemoryProvider } from "../provider/memory.js";
import { testFlags } from "../provider/test-flags.js";

import { scenarios } from "./feature.js";

/** Every scenario heading this file transcribes, as `evaluation_v2.feature` writes it. */
const TRANSCRIBED = [
	"Resolve values",
	"Resolves zero value",
	"Resolves zero value with targeting",
	"Resolves zero value with targeting using default",
	"Flag not found error",
	"Type mismatch error",
	"Provider not ready error",
	"Provider in fatal state error",
	"Complete evaluation details structure",
	"Flag metadata in evaluation details",
	"Empty evaluation context",
	"Null context values",
	"Multiple context attributes targeting",
	"Structure flag evaluation",
	"Variant field population",
	"CACHED reason",
	"DISABLED reason",
	"Provider status accessibility",
	"Evaluation options with hooks",
	"Evaluation context immutability",
	"Asynchronous flag evaluation",
];

/**
 * What the structure evaluations are checked against. Every object flag of the
 * vendored set holds plain JSON under arbitrary keys, so the schema checks the
 * shape and leaves the values to the Examples table.
 */
const Structure = s
	.record(s.string(), s.any())
	.transform((value) => value as Record<string, JSONValue>);

/** The `object-flag` template variant, as the Examples tables spell it out. */
const TEMPLATE = { showImages: true, title: "Check out these pics!", imagesPerPage: 100 };

/** The context the targeting expressions of the vendored flag set match on. */
const BALLMER: EvaluationContext = { email: "ballmer@macrosoft.com" };

/**
 * A provider over the specification's flag set that announces whichever status
 * a scenario names, so "a fatal provider" is a transition the client was told
 * about rather than a field somebody set behind it.
 */
class Announcing implements Provider {
	readonly metadata: ProviderMetadata = { name: "announcing" };
	readonly events = new ProviderEvents();

	#inner = new InMemoryProvider(testFlags());
	#status: ProviderStatus;

	constructor(status: ProviderStatus) {
		this.#status = status;
	}

	async initialize(context: EvaluationContext): Promise<void> {
		await this.#inner.initialize(context);

		if (this.#status === "NOT_READY") return;

		if (this.#status === "ERROR" || this.#status === "FATAL") {
			this.events.emit("PROVIDER_ERROR", {
				errorCode: this.#status === "FATAL" ? "PROVIDER_FATAL" : "GENERAL",
				message: `The provider announced ${this.#status}.`,
			});
			return;
		}

		this.events.emit("PROVIDER_READY");
		if (this.#status === "STALE") this.events.emit("PROVIDER_STALE");
	}

	resolveBoolean(key: string, defaultValue: boolean, context: EvaluationContext) {
		return this.#inner.resolveBoolean(key, defaultValue, context);
	}

	resolveString(key: string, defaultValue: string, context: EvaluationContext) {
		return this.#inner.resolveString(key, defaultValue, context);
	}

	resolveNumber(key: string, defaultValue: number, context: EvaluationContext) {
		return this.#inner.resolveNumber(key, defaultValue, context);
	}

	resolveObject(
		key: string,
		defaultValue: JSONValue,
		context: EvaluationContext,
	): ResolutionDetails<JSONValue> {
		return this.#inner.resolveObject(key, defaultValue, context);
	}
}

/** Given a provider in `status`, registered and initialized. */
async function client(status: ProviderStatus = "READY"): Promise<Client> {
	let flags = createFlags({ provider: () => new Announcing(status) });
	await flags.ready();
	return flags.getClient();
}

/** When the flag was evaluated with details, through the method the `type` column names. */
function details(
	from: Client,
	flagType: string,
	key: string,
	defaultValue: FlagValue,
	context?: EvaluationContext,
): Promise<EvaluationDetails<FlagValue>> {
	if (flagType === "Boolean") return from.booleanDetails(key, defaultValue as boolean, context);
	if (flagType === "String") return from.stringDetails(key, defaultValue as string, context);

	if (flagType === "Object") {
		return from.objectDetails(
			key,
			defaultValue as Record<string, JSONValue>,
			{ schema: Structure },
			context,
		);
	}

	return from.numberDetails(key, defaultValue as number, context);
}

/** The flags the Examples tables reach for whenever they want a plain resolution. */
const RESOLVED = [
	{ key: "boolean-flag", flagType: "Boolean", fallback: false, value: true, variant: "on" },
	{ key: "string-flag", flagType: "String", fallback: "bye", value: "hi", variant: "greeting" },
	{ key: "integer-flag", flagType: "Integer", fallback: 1, value: 10, variant: "ten" },
	{ key: "float-flag", flagType: "Float", fallback: 0.1, value: 0.5, variant: "half" },
	{ key: "object-flag", flagType: "Object", fallback: {}, value: TEMPLATE, variant: "template" },
];

/** The flags whose default variant holds the zero value of its type. */
const ZERO = [
	{ key: "boolean-zero-flag", flagType: "Boolean", fallback: true, value: false },
	{ key: "string-zero-flag", flagType: "String", fallback: "hi", value: "" },
	{ key: "integer-zero-flag", flagType: "Integer", fallback: 1, value: 0 },
	{ key: "float-zero-flag", flagType: "Float", fallback: 0.1, value: 0.0 },
	{ key: "object-zero-flag", flagType: "Object", fallback: { a: 1 }, value: {} },
];

/** The same zero values behind a targeting rule, which the Examples tables reuse four times. */
const TARGETED_ZERO = [
	{ key: "boolean-targeted-zero-flag", flagType: "Boolean", fallback: true, value: false },
	{ key: "string-targeted-zero-flag", flagType: "String", fallback: "hi", value: "" },
	{ key: "integer-targeted-zero-flag", flagType: "Integer", fallback: 1, value: 0 },
	{ key: "float-targeted-zero-flag", flagType: "Float", fallback: 0.1, value: 0.0 },
	{ key: "object-targeted-zero-flag", flagType: "Object", fallback: { a: 1 }, value: {} },
];

test("every scenario of evaluation_v2.feature is transcribed", () => {
	let declared = scenarios("evaluation_v2.feature");

	expect(TRANSCRIBED.length).toBeGreaterThanOrEqual(21);
	expect(declared.filter((title) => !TRANSCRIBED.includes(title))).toEqual([]);
});

describe("Resolve values", () => {
	test.each(RESOLVED)("$flagType $key", async ({ key, flagType, fallback, value }) => {
		expect((await details(await client(), flagType, key, fallback)).value).toEqual(value);
	});
});

describe("Resolves zero value", () => {
	test.each(ZERO)("$flagType $key", async ({ key, flagType, fallback, value }) => {
		expect(await details(await client(), flagType, key, fallback)).toMatchObject({
			value,
			reason: "STATIC",
		});
	});
});

describe("Resolves zero value with targeting", () => {
	test.each(TARGETED_ZERO)("$flagType $key", async ({ key, flagType, fallback, value }) => {
		expect(await details(await client(), flagType, key, fallback, BALLMER)).toMatchObject({
			value,
			reason: "TARGETING_MATCH",
		});
	});
});

describe("Resolves zero value with targeting using default", () => {
	test.each(TARGETED_ZERO)("$flagType $key", async ({ key, flagType, fallback, value }) => {
		let context: EvaluationContext = { email: "ballmer@none.com" };

		expect(await details(await client(), flagType, key, fallback, context)).toMatchObject({
			value,
			reason: "DEFAULT",
		});
	});
});

describe("Flag not found error", () => {
	test.each([
		{ flagType: "Boolean", fallback: false },
		{ flagType: "String", fallback: "bye" },
		{ flagType: "Integer", fallback: 1 },
		{ flagType: "Float", fallback: 0.1 },
		{ flagType: "Object", fallback: { a: 1 } },
	])("$flagType", async ({ flagType, fallback }) => {
		expect(await details(await client(), flagType, "non-existent-flag", fallback)).toMatchObject({
			value: fallback,
			reason: "ERROR",
			errorCode: "FLAG_NOT_FOUND",
		});
	});
});

describe("Type mismatch error", () => {
	test.each([
		{ key: "string-flag", flagType: "Boolean", fallback: false },
		{ key: "boolean-flag", flagType: "String", fallback: "bye" },
		{ key: "boolean-flag", flagType: "Integer", fallback: 1 },
		{ key: "boolean-flag", flagType: "Float", fallback: 0.1 },
		{ key: "boolean-flag", flagType: "Object", fallback: { a: 1 } },
	])("$flagType $key", async ({ key, flagType, fallback }) => {
		expect(await details(await client(), flagType, key, fallback)).toMatchObject({
			value: fallback,
			reason: "ERROR",
			errorCode: "TYPE_MISMATCH",
		});
	});
});

describe("Provider not ready error", () => {
	test.each(RESOLVED)("$flagType $key", async ({ key, flagType, fallback }) => {
		expect(await details(await client("NOT_READY"), flagType, key, fallback)).toMatchObject({
			value: fallback,
			reason: "ERROR",
			errorCode: "PROVIDER_NOT_READY",
		});
	});
});

describe("Provider in fatal state error", () => {
	test.each(RESOLVED)("$flagType $key", async ({ key, flagType, fallback }) => {
		expect(await details(await client("FATAL"), flagType, key, fallback)).toMatchObject({
			value: fallback,
			reason: "ERROR",
			errorCode: "PROVIDER_FATAL",
		});
	});
});

describe("Complete evaluation details structure", () => {
	test.each(RESOLVED)("$flagType $key", async ({ key, flagType, fallback, value, variant }) => {
		expect(await details(await client(), flagType, key, fallback)).toMatchObject({
			value,
			flagKey: key,
			variant,
			reason: "STATIC",
		});
	});
});

test("Flag metadata in evaluation details", async () => {
	let resolution = await (await client()).booleanDetails("metadata-flag", true);

	expect(resolution.flagMetadata).toEqual({
		string: "1.0.2",
		integer: 2,
		float: 0.1,
		boolean: true,
	});
});

describe("Empty evaluation context", () => {
	test.each([
		{ key: "boolean-targeted-zero-flag", flagType: "Boolean", fallback: true, value: false },
		{ key: "string-targeted-zero-flag", flagType: "String", fallback: "str", value: "" },
		{ key: "integer-targeted-zero-flag", flagType: "Integer", fallback: 1, value: 0 },
		{ key: "float-targeted-zero-flag", flagType: "Float", fallback: 1.0, value: 0.0 },
		{ key: "object-targeted-zero-flag", flagType: "Object", fallback: { a: 1 }, value: {} },
	])("$flagType $key", async ({ key, flagType, fallback, value }) => {
		expect(await details(await client(), flagType, key, fallback)).toMatchObject({
			value,
			reason: "DEFAULT",
		});
	});
});

describe("Null context values", () => {
	test.each([
		{ key: "boolean-targeted-zero-flag", flagType: "Boolean", fallback: true, value: false },
		{ key: "string-targeted-zero-flag", flagType: "String", fallback: "str", value: "" },
		{ key: "integer-targeted-zero-flag", flagType: "Integer", fallback: 1, value: 0 },
		{ key: "float-targeted-zero-flag", flagType: "Float", fallback: 1.0, value: 0.0 },
		{ key: "object-targeted-zero-flag", flagType: "Object", fallback: { a: 1 }, value: {} },
	])("$flagType $key", async ({ key, flagType, fallback, value }) => {
		let context: EvaluationContext = { email: null };

		expect(await details(await client(), flagType, key, fallback, context)).toMatchObject({
			value,
			reason: "DEFAULT",
		});
	});
});

test("Multiple context attributes targeting", async () => {
	let context: EvaluationContext = {
		email: "ballmer@macrosoft.com",
		role: "admin",
		age: 65,
		customer: false,
	};

	expect(
		await (await client()).stringDetails("complex-targeted", "default", context),
	).toMatchObject({ value: "INTERNAL", reason: "TARGETING_MATCH" });
});

test("Structure flag evaluation", async () => {
	expect(
		await (await client()).objectDetails("object-flag", {}, { schema: Structure }),
	).toMatchObject({ value: TEMPLATE, reason: "STATIC" });
});

describe("Variant field population", () => {
	test.each(RESOLVED)("$flagType $key", async ({ key, flagType, fallback, variant }) => {
		expect((await details(await client(), flagType, key, fallback)).variant).toBe(variant);
	});
});

// `CACHED` is a reason a provider with a cache reports, and the in-memory provider
// the suites evaluate against resolves from memory (ADR-059 decision 18).
describe.skip("CACHED reason", () => {
	test.each([
		{ key: "boolean-flag", flagType: "Boolean", fallback: false },
		{ key: "string-flag", flagType: "String", fallback: "bye" },
	])("$flagType $key", async ({ key, flagType, fallback }) => {
		let evaluating = await client();

		await details(evaluating, flagType, key, fallback);

		expect((await details(evaluating, flagType, key, fallback)).reason).toBe("CACHED");
	});
});

describe("DISABLED reason", () => {
	test.each([
		{ key: "boolean-disabled-flag", flagType: "Boolean", fallback: false },
		{ key: "string-disabled-flag", flagType: "String", fallback: "bye" },
		{ key: "integer-disabled-flag", flagType: "Integer", fallback: 1 },
		{ key: "float-disabled-flag", flagType: "Float", fallback: 0.1 },
		{ key: "object-disabled-flag", flagType: "Object", fallback: { a: 1 } },
	])("$flagType $key", async ({ key, flagType, fallback }) => {
		expect(await details(await client(), flagType, key, fallback)).toMatchObject({
			value: fallback,
			reason: "DISABLED",
		});
	});
});

describe("Provider status accessibility", () => {
	test.each([
		{ status: "stable", code: "READY" },
		{ status: "not ready", code: "NOT_READY" },
		{ status: "error", code: "ERROR" },
		{ status: "fatal", code: "FATAL" },
		{ status: "stale", code: "STALE" },
	])("$status", async ({ code }) => {
		expect((await client(code as ProviderStatus)).providerStatus).toBe(code);
	});
});

test("Evaluation options with hooks", async () => {
	let order: string[] = [];

	await (
		await client()
	).booleanDetails("boolean-flag", false, undefined, {
		hooks: [
			{
				before: () => void order.push("first before"),
				after: () => void order.push("first after"),
			},
			{
				before: () => void order.push("second before"),
				after: () => void order.push("second after"),
			},
		],
	});

	expect(order).toEqual(["first before", "second before", "second after", "first after"]);
});

test("Evaluation context immutability", async () => {
	let context: EvaluationContext = { targetingKey: "user1", email: "ballmer@macrosoft.com" };
	let unmodified = { ...context };

	let resolution = await (
		await client()
	).booleanDetails("boolean-flag", false, context, {
		hooks: [{ before: () => ({ email: "jobs@orange.com", age: 65 }) }],
	});

	expect(context).toEqual(unmodified);
	expect(Object.isFrozen(resolution.flagMetadata)).toBe(true);
});

describe("Asynchronous flag evaluation", () => {
	test.each(RESOLVED)("$flagType $key", async ({ key, flagType, fallback, value }) => {
		let pending = details(await client(), flagType, key, fallback);

		expect(pending).toBeInstanceOf(Promise);
		expect((await pending).value).toEqual(value);
	});
});
