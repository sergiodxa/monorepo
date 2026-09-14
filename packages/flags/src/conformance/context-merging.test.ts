/**
 * `contextMerging.feature`, scenario by scenario: which levels reach the
 * provider, and which one wins when two of them set the same key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { describe, expect, test } from "vitest";

import type { EvaluationContext } from "../core/context.js";
import type { ResolutionDetails } from "../core/details.js";
import type { ProviderMetadata } from "../core/metadata.js";
import type { FlagValue } from "../core/value.js";
import type { Provider } from "../provider/provider.js";

import { asyncLocalStoragePropagator, createFlags } from "../client/index.js";
import { resolved } from "../provider/details.js";

import { scenarios } from "./feature.js";

/** Every scenario heading this file transcribes, as `contextMerging.feature` writes it. */
const TRANSCRIBED = [
	"A context entry is added to a single level",
	"For a transaction, a context entry is added to each level with different keys",
	"For a hook, a context entry is added to each level with different keys",
	"For a transaction and a hook, a context entry is added to each level with different keys",
	"For a transaction, a context entry in one level overwrites values with the same key from preceding levels",
	"For a hook, a context entry in one level overwrites values with the same key from preceding levels",
	"For a transaction and a hook, context entry in one level overwrites values with the same key from preceding levels",
];

/** The merge levels this package has, lowest precedence first. */
type Level = "API" | "Transaction" | "Client" | "Invocation" | "Before Hooks";

/** What each level contributes to one evaluation. */
type Entries = Partial<Record<Level, EvaluationContext>>;

/** Given a stable provider with retrievable context is registered. */
class Retrievable implements Provider {
	readonly metadata: ProviderMetadata = { name: "retrievable" };

	/** The merged context of the most recent resolution. */
	context: EvaluationContext = {};

	resolveBoolean(_key: string, defaultValue: boolean, context: EvaluationContext) {
		return this.#answer(defaultValue, context);
	}

	resolveString(_key: string, defaultValue: string, context: EvaluationContext) {
		return this.#answer(defaultValue, context);
	}

	resolveNumber(_key: string, defaultValue: number, context: EvaluationContext) {
		return this.#answer(defaultValue, context);
	}

	resolveObject(_key: string, defaultValue: JSONValue, context: EvaluationContext) {
		return this.#answer(defaultValue, context);
	}

	#answer<T extends FlagValue>(defaultValue: T, context: EvaluationContext): ResolutionDetails<T> {
		this.context = context;
		return resolved(defaultValue, { reason: "STATIC" });
	}
}

/**
 * Evaluates one flag with every level in `entries` carrying what it names, and
 * answers with the context the provider was handed.
 */
async function merged(entries: Entries): Promise<EvaluationContext> {
	let provider = new Retrievable();
	let flags = createFlags({
		provider: () => provider,
		propagator: asyncLocalStoragePropagator(),
	});

	await flags.ready();

	if (entries.API) flags.setContext(entries.API);

	let addition = entries["Before Hooks"];
	let client = flags.getClient(undefined, entries.Client);
	let evaluate = () =>
		client.booleanDetails("some-flag", false, entries.Invocation, {
			hooks: addition ? [{ before: () => addition }] : undefined,
		});

	if (entries.Transaction) await flags.setTransactionContext(entries.Transaction, evaluate);
	else await evaluate();

	return provider.context;
}

/** Context entries for each level from the API level down to `target`, keyed on "key". */
function ladder(levels: Level[], target: Level): Entries {
	let entries: Entries = {};

	for (let level of levels.slice(0, levels.indexOf(target) + 1)) entries[level] = { key: level };

	return entries;
}

test("every scenario of contextMerging.feature is transcribed", () => {
	let declared = scenarios("contextMerging.feature");

	expect(TRANSCRIBED.length).toBeGreaterThanOrEqual(7);
	expect(declared.filter((title) => !TRANSCRIBED.includes(title))).toEqual([]);
});

describe("A context entry is added to a single level", () => {
	test.each([
		{ tags: "@transaction", level: "API" },
		{ tags: "@transaction", level: "Transaction" },
		{ tags: "@transaction", level: "Client" },
		{ tags: "@transaction", level: "Invocation" },
		{ tags: "@hooks", level: "API" },
		{ tags: "@hooks", level: "Client" },
		{ tags: "@hooks", level: "Invocation" },
		{ tags: "@hooks", level: "Before Hooks" },
		{ tags: "@hooks @transaction", level: "API" },
		{ tags: "@hooks @transaction", level: "Transaction" },
		{ tags: "@hooks @transaction", level: "Client" },
		{ tags: "@hooks @transaction", level: "Invocation" },
		{ tags: "@hooks @transaction", level: "Before Hooks" },
	] satisfies { tags: string; level: Level }[])("$tags: $level", async ({ level }) => {
		expect(await merged({ [level]: { key: "value" } })).toMatchObject({ key: "value" });
	});
});

test("For a transaction, a context entry is added to each level with different keys", async () => {
	expect(
		await merged({
			API: { API: "API value" },
			Transaction: { Transaction: "Transaction value" },
			Client: { Client: "Client value" },
			Invocation: { Invocation: "Invocation value" },
		}),
	).toMatchObject({
		API: "API value",
		Transaction: "Transaction value",
		Client: "Client value",
		Invocation: "Invocation value",
	});
});

test("For a hook, a context entry is added to each level with different keys", async () => {
	expect(
		await merged({
			API: { API: "API value" },
			Client: { Client: "Client value" },
			Invocation: { Invocation: "Invocation value" },
			"Before Hooks": { "Before Hooks": "Before Hooks value" },
		}),
	).toMatchObject({
		API: "API value",
		Client: "Client value",
		Invocation: "Invocation value",
		"Before Hooks": "Before Hooks value",
	});
});

test("For a transaction and a hook, a context entry is added to each level with different keys", async () => {
	expect(
		await merged({
			API: { API: "API value" },
			Transaction: { Transaction: "Transaction value" },
			Client: { Client: "Client value" },
			Invocation: { Invocation: "Invocation value" },
			"Before Hooks": { "Before Hooks": "Before Hooks value" },
		}),
	).toMatchObject({
		API: "API value",
		Transaction: "Transaction value",
		Client: "Client value",
		Invocation: "Invocation value",
		"Before Hooks": "Before Hooks value",
	});
});

describe("For a transaction, a context entry in one level overwrites values with the same key from preceding levels", () => {
	let levels: Level[] = ["API", "Transaction", "Client", "Invocation"];

	test.each(levels)("%s", async (level) => {
		expect(await merged(ladder(levels, level))).toMatchObject({ key: level });
	});
});

describe("For a hook, a context entry in one level overwrites values with the same key from preceding levels", () => {
	let levels: Level[] = ["API", "Client", "Invocation", "Before Hooks"];

	test.each(levels)("%s", async (level) => {
		expect(await merged(ladder(levels, level))).toMatchObject({ key: level });
	});
});

describe("For a transaction and a hook, context entry in one level overwrites values with the same key from preceding levels", () => {
	let levels: Level[] = ["API", "Transaction", "Client", "Invocation", "Before Hooks"];

	test.each(levels)("%s", async (level) => {
		expect(await merged(ladder(levels, level))).toMatchObject({ key: level });
	});
});
