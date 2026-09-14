/**
 * `hooks.feature`, scenario by scenario: which stages an evaluation runs, and
 * the evaluation details the stages that unwind are handed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import type { Client } from "../core/client.js";
import type { EvaluationDetails } from "../core/details.js";
import type { HookStage } from "../core/hook.js";
import type { FlagValue } from "../core/value.js";

import { createFlags } from "../client/index.js";
import { InMemoryProvider } from "../provider/memory.js";
import { testFlags } from "../provider/test-flags.js";

import { scenarios } from "./feature.js";

/** Every scenario heading this file transcribes, as `hooks.feature` writes it. */
const TRANSCRIBED = [
	"Passes evaluation details to after and finally hooks",
	"Flag not found",
	"Type error",
];

/** What the added hook saw: the stages it ran, and the details each of them was given. */
interface Recording {
	stages: HookStage[];
	details: Partial<Record<HookStage, EvaluationDetails<FlagValue>>>;
}

/** Given a stable provider, and a client with added hook. */
async function withHook(): Promise<{ client: Client; recording: Recording }> {
	let flags = createFlags({ provider: () => new InMemoryProvider(testFlags()) });
	await flags.ready();

	let recording: Recording = { stages: [], details: {} };
	let client = flags.getClient();

	client.addHooks({
		before() {
			recording.stages.push("before");
		},
		after(_context, details) {
			recording.stages.push("after");
			recording.details.after = details;
		},
		error() {
			recording.stages.push("error");
		},
		finally(_context, details) {
			recording.stages.push("finally");
			recording.details.finally = details;
		},
	});

	return { client, recording };
}

test("every scenario of hooks.feature is transcribed", () => {
	let declared = scenarios("hooks.feature");

	expect(TRANSCRIBED.length).toBeGreaterThanOrEqual(3);
	expect(declared.filter((title) => !TRANSCRIBED.includes(title))).toEqual([]);
});

test("Passes evaluation details to after and finally hooks", async () => {
	let { client, recording } = await withHook();

	await client.booleanDetails("boolean-flag", false);

	expect(recording.stages).toContain("before");

	for (let stage of ["after", "finally"] as const) {
		expect(recording.details[stage]).toMatchObject({
			flagKey: "boolean-flag",
			value: true,
			variant: "on",
			reason: "STATIC",
		});
		expect(recording.details[stage]?.errorCode).toBeUndefined();
	}
});

test("Flag not found", async () => {
	let { client, recording } = await withHook();

	await client.stringDetails("missing-flag", "uh-oh");

	expect(recording.stages).toContain("before");
	expect(recording.stages).toContain("error");
	expect(recording.details.finally).toMatchObject({
		flagKey: "missing-flag",
		value: "uh-oh",
		reason: "ERROR",
		errorCode: "FLAG_NOT_FOUND",
	});
	expect(recording.details.finally?.variant).toBeUndefined();
});

test("Type error", async () => {
	let { client, recording } = await withHook();

	await client.booleanDetails("wrong-flag", false);

	expect(recording.stages).toContain("before");
	expect(recording.stages).toContain("error");
	expect(recording.details.finally).toMatchObject({
		flagKey: "wrong-flag",
		value: false,
		reason: "ERROR",
		errorCode: "TYPE_MISMATCH",
	});
	expect(recording.details.finally?.variant).toBeUndefined();
});
