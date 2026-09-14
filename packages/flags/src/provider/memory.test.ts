/**
 * The in-memory provider: what each resolver answers, what it refuses to
 * answer, and what it announces as it starts, changes and stops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { EvaluationContext } from "../core/context.js";

import { conformance } from "../testing/conformance.js";

import type { FlagSet } from "./memory.js";

import { InMemoryProvider } from "./memory.js";
import { testFlags } from "./test-flags.js";

const FLAGS: FlagSet = {
	"boolean-flag": { variants: { on: true, off: false }, defaultVariant: "on" },
	"string-flag": { variants: { greeting: "hi", parting: "bye" }, defaultVariant: "greeting" },
	"number-flag": { variants: { one: 1, ten: 10 }, defaultVariant: "ten" },
	"object-flag": {
		variants: { empty: {}, template: { title: "Check out these pics!" } },
		defaultVariant: "template",
	},
	"disabled-flag": { variants: { on: true, off: false }, defaultVariant: "on", disabled: true },
	"metadata-flag": {
		variants: { on: true, off: false },
		defaultVariant: "on",
		flagMetadata: { flagSetId: "checkout", version: 2, cached: true },
	},
	"targeted-flag": {
		variants: { internal: "INTERNAL", external: "EXTERNAL" },
		defaultVariant: "external",
		contextEvaluator: (context) => (context.staff === true ? "internal" : ""),
	},
	"missing-variant-flag": { variants: { on: true }, defaultVariant: "off" },
	"throwing-flag": {
		variants: { on: true, off: false },
		defaultVariant: "off",
		contextEvaluator: () => {
			throw new Error("The rule engine gave up.");
		},
	},
};

async function provider(flags: FlagSet = FLAGS): Promise<InMemoryProvider> {
	let instance = new InMemoryProvider(flags);
	await instance.initialize();
	return instance;
}

test("Requirement 2.1.1 — identifies the provider implementation by name", () => {
	expect(new InMemoryProvider().metadata.name).toBe("in-memory");
});

test("Requirement 2.2.1 — resolves from a key, a default value and a context", async () => {
	let flags = await provider();

	expect(flags.resolveString("targeted-flag", "NONE", { staff: true })).toEqual({
		value: "INTERNAL",
		variant: "internal",
		reason: "TARGETING_MATCH",
	});
});

test("Requirement 2.2.2.1 — resolves booleans, strings, numbers and structures", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("boolean-flag", false)).toEqual({
		value: true,
		variant: "on",
		reason: "STATIC",
	});
	expect(flags.resolveString("string-flag", "none")).toEqual({
		value: "hi",
		variant: "greeting",
		reason: "STATIC",
	});
	expect(flags.resolveNumber("number-flag", 0)).toEqual({
		value: 10,
		variant: "ten",
		reason: "STATIC",
	});
	expect(flags.resolveObject("object-flag", {})).toEqual({
		value: { title: "Check out these pics!" },
		variant: "template",
		reason: "STATIC",
	});
});

test("answers without allocating a promise", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("boolean-flag", false)).not.toBeInstanceOf(Promise);
});

test("Requirement 2.2.9 — sets the flag metadata the configuration carries", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("metadata-flag", false).flagMetadata).toEqual({
		flagSetId: "checkout",
		version: 2,
		cached: true,
	});
});

test("Requirement 2.2.10 — carries string, number and boolean metadata values", async () => {
	let flags = await provider(testFlags());
	let metadata = flags.resolveBoolean("metadata-flag", false).flagMetadata ?? {};

	expect(metadata).toEqual({ string: "1.0.2", integer: 2, boolean: true, float: 0.1 });
	for (let value of Object.values(metadata)) {
		expect(["string", "number", "boolean"]).toContain(typeof value);
	}
});

test("invents no metadata for a flag that carries none", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("boolean-flag", false)).not.toHaveProperty("flagMetadata");
});

test("answers FLAG_NOT_FOUND for a key it has no flag for", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("absent-flag", true)).toEqual({
		value: true,
		reason: "ERROR",
		errorCode: "FLAG_NOT_FOUND",
		errorMessage: 'No flag named "absent-flag".',
	});
});

test("answers TYPE_MISMATCH when the variant holds another type", async () => {
	let flags = await provider();

	expect(flags.resolveNumber("string-flag", 7)).toMatchObject({
		value: 7,
		reason: "ERROR",
		errorCode: "TYPE_MISMATCH",
	});
	expect(flags.resolveBoolean("object-flag", false)).toMatchObject({
		errorCode: "TYPE_MISMATCH",
	});
});

test("answers GENERAL when the chosen variant is not in the flag", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("missing-variant-flag", false)).toMatchObject({
		value: false,
		reason: "ERROR",
		errorCode: "GENERAL",
	});
});

test("answers GENERAL when the targeting function throws", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("throwing-flag", true)).toMatchObject({
		value: true,
		reason: "ERROR",
		errorCode: "GENERAL",
		errorMessage: expect.stringContaining("The rule engine gave up."),
	});
});

test("Requirement 2.2.5 — a disabled flag serves the default value with reason DISABLED", async () => {
	let flags = await provider();

	expect(flags.resolveBoolean("disabled-flag", false)).toEqual({
		value: false,
		reason: "DISABLED",
	});
});

test("Requirement 2.2.4 — names the variant targeting picked", async () => {
	let flags = await provider();

	expect(flags.resolveString("targeted-flag", "NONE", { staff: true })).toMatchObject({
		variant: "internal",
		reason: "TARGETING_MATCH",
	});
	expect(flags.resolveString("targeted-flag", "NONE", { staff: false })).toMatchObject({
		variant: "external",
		reason: "DEFAULT",
	});
});

test("Requirement 2.8.2 — emits PROVIDER_READY before initialize returns", async () => {
	let flags = new InMemoryProvider(FLAGS);
	let ready = vi.fn();

	flags.events.on("PROVIDER_READY", ready);
	await flags.initialize();

	expect(ready).toHaveBeenCalledTimes(1);
});

test("Requirement 2.8.3 — emits PROVIDER_ERROR before initialize rejects", async () => {
	let flags = new InMemoryProvider({ "empty-flag": { variants: {}, defaultVariant: "on" } });
	let error = vi.fn();

	flags.events.on("PROVIDER_ERROR", error);

	await expect(flags.initialize()).rejects.toThrow(/empty-flag/);
	expect(error).toHaveBeenCalledWith({
		errorCode: "PROVIDER_FATAL",
		message: expect.stringContaining("empty-flag"),
	});
});

test("Requirement 2.8.1 — signals every status transition by emitting", async () => {
	let flags = new InMemoryProvider(FLAGS);
	let ready = vi.fn();
	let changed = vi.fn();

	flags.events.on("PROVIDER_READY", ready);
	flags.events.on("PROVIDER_CONFIGURATION_CHANGED", changed);

	await flags.initialize();
	flags.putConfiguration({});
	await flags.shutdown();
	await flags.initialize();

	expect(ready).toHaveBeenCalledTimes(2);
	expect(changed).toHaveBeenCalledTimes(1);
});

test("answers PROVIDER_NOT_READY before initialize has run", () => {
	let flags = new InMemoryProvider(FLAGS);

	expect(flags.resolveBoolean("boolean-flag", false)).toMatchObject({
		value: false,
		reason: "ERROR",
		errorCode: "PROVIDER_NOT_READY",
	});
});

test("emits PROVIDER_CONFIGURATION_CHANGED naming both sides of the swap", async () => {
	let flags = await provider({
		"old-flag": { variants: { on: true }, defaultVariant: "on" },
		"kept-flag": { variants: { on: true }, defaultVariant: "on" },
	});
	let changed = vi.fn();

	flags.events.on("PROVIDER_CONFIGURATION_CHANGED", changed);
	flags.putConfiguration({
		"kept-flag": { variants: { off: false }, defaultVariant: "off" },
		"new-flag": { variants: { on: true }, defaultVariant: "on" },
	});

	expect(changed).toHaveBeenCalledWith({ flagsChanged: ["old-flag", "kept-flag", "new-flag"] });
	expect(flags.resolveBoolean("kept-flag", true)).toMatchObject({ value: false, variant: "off" });
	expect(flags.resolveBoolean("old-flag", true)).toMatchObject({ errorCode: "FLAG_NOT_FOUND" });
});

test("Requirement 2.5.2 — reverts to its uninitialized state after shutdown", async () => {
	let flags = await provider();

	await flags.shutdown();

	expect(flags.resolveBoolean("boolean-flag", false)).toMatchObject({
		errorCode: "PROVIDER_NOT_READY",
	});
});

test("Requirement 2.5.3 — shutting down twice does nothing the second time", async () => {
	let flags = await provider();

	await flags.shutdown();
	await expect(flags.shutdown()).resolves.toBeUndefined();

	await flags.initialize();
	expect(flags.resolveBoolean("boolean-flag", false)).toMatchObject({ value: true });
});

describe("the specification's own flag set", () => {
	/** The context the vendored suites target with, matching every targeting rule in the file. */
	const BALLMER: EvaluationContext = {
		targetingKey: "user1",
		email: "ballmer@macrosoft.com",
		customer: false,
		age: 25,
	};

	test("resolves every standard flag to its default variant", async () => {
		let flags = await provider(testFlags());

		expect(flags.resolveBoolean("boolean-flag", false)).toEqual({
			value: true,
			variant: "on",
			reason: "STATIC",
		});
		expect(flags.resolveString("string-flag", "none")).toEqual({
			value: "hi",
			variant: "greeting",
			reason: "STATIC",
		});
		expect(flags.resolveNumber("integer-flag", 0)).toEqual({
			value: 10,
			variant: "ten",
			reason: "STATIC",
		});
		expect(flags.resolveNumber("float-flag", 0)).toEqual({
			value: 0.5,
			variant: "half",
			reason: "STATIC",
		});
		expect(flags.resolveObject("object-flag", {})).toEqual({
			value: { showImages: true, title: "Check out these pics!", imagesPerPage: 100 },
			variant: "template",
			reason: "STATIC",
		});
	});

	test("serves the default value for every disabled flag", async () => {
		let flags = await provider(testFlags());

		expect(flags.resolveBoolean("boolean-disabled-flag", false)).toEqual({
			value: false,
			reason: "DISABLED",
		});
		expect(flags.resolveString("string-disabled-flag", "fallback")).toEqual({
			value: "fallback",
			reason: "DISABLED",
		});
		expect(flags.resolveNumber("integer-disabled-flag", 13)).toEqual({
			value: 13,
			reason: "DISABLED",
		});
		expect(flags.resolveNumber("float-disabled-flag", 13.4)).toEqual({
			value: 13.4,
			reason: "DISABLED",
		});
		expect(flags.resolveObject("object-disabled-flag", { fallback: true })).toEqual({
			value: { fallback: true },
			reason: "DISABLED",
		});
	});

	test("targets the zero variant on the context the suites use", async () => {
		let flags = await provider(testFlags());

		expect(flags.resolveBoolean("boolean-targeted-zero-flag", true, BALLMER)).toEqual({
			value: false,
			variant: "zero",
			reason: "TARGETING_MATCH",
		});
		expect(flags.resolveString("string-targeted-zero-flag", "fallback", BALLMER)).toEqual({
			value: "",
			variant: "zero",
			reason: "TARGETING_MATCH",
		});
		expect(flags.resolveNumber("integer-targeted-zero-flag", 13, BALLMER)).toEqual({
			value: 0,
			variant: "zero",
			reason: "TARGETING_MATCH",
		});
		expect(flags.resolveObject("object-targeted-zero-flag", { fallback: true }, BALLMER)).toEqual({
			value: {},
			variant: "zero",
			reason: "TARGETING_MATCH",
		});
	});

	test("falls back to the default variant when targeting matches nothing", async () => {
		let flags = await provider(testFlags());
		let context: EvaluationContext = { targetingKey: "user3", email: "jobs@orange.com" };

		expect(flags.resolveString("complex-targeted", "none", context)).toEqual({
			value: "EXTERNAL",
			variant: "external",
			reason: "DEFAULT",
		});
	});

	test("reads every field of the complex targeting rule", async () => {
		let flags = await provider(testFlags());

		expect(flags.resolveString("complex-targeted", "none", BALLMER)).toEqual({
			value: "INTERNAL",
			variant: "internal",
			reason: "TARGETING_MATCH",
		});
		expect(flags.resolveString("complex-targeted", "none", { ...BALLMER, customer: true })).toEqual(
			{ value: "EXTERNAL", variant: "external", reason: "DEFAULT" },
		);
		expect(flags.resolveString("complex-targeted", "none", { ...BALLMER, age: 8 })).toEqual({
			value: "EXTERNAL",
			variant: "external",
			reason: "DEFAULT",
		});
	});

	test("reports the error the edge-case flags exist to produce", async () => {
		let flags = await provider(testFlags());

		expect(flags.resolveBoolean("null-default-flag", true)).toMatchObject({
			errorCode: "GENERAL",
		});
		expect(flags.resolveNumber("undefined-default-flag", 13)).toMatchObject({
			errorCode: "GENERAL",
		});
		expect(flags.resolveNumber("wrong-flag", 13)).toMatchObject({
			value: 13,
			errorCode: "TYPE_MISMATCH",
		});
	});

	test("loads every flag the vendored file declares", () => {
		expect(Object.keys(testFlags())).toHaveLength(25);
	});
});

conformance("in-memory", () => new InMemoryProvider(FLAGS), {
	flags: FLAGS,
	lifecycle: true,
	failing: () => new InMemoryProvider({ "empty-flag": { variants: {}, defaultVariant: "on" } }),
});
