/**
 * Tests for the built-in `spec` plugin: three observables over the run
 * identity the runner fixed. The plugin generates nothing, so every case here
 * hands `createToolContext` a run and checks the tool reports it back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SpecError } from "../errors.js";
import type { RunIdentity, ToolContext } from "../plugin.js";
import type { Value } from "../values.js";

import { createToolContext } from "../tool-context.js";

import { createSpecPlugin } from "./spec.js";

const PLUGIN = createSpecPlugin();

/** A context whose run identity is the one this case is about. */
function contextFor(run: RunIdentity): ToolContext {
	return createToolContext({ run });
}

/** The run identity a real second attempt of a run would carry. */
function secondAttempt(): RunIdentity {
	return { id: "2026-09-10T12-00-00", attempt: 2, nonce: "2026-09-10T12-00-00-2" };
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

describe(createSpecPlugin.name, () => {
	test("describes three permissionless observables, each taking an expected value", () => {
		expect(PLUGIN.namespace).toBe("spec");
		let tools = PLUGIN.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["run_id", "attempt", "nonce"]);
		for (let tool of tools) {
			expect(tool.kind).toBe("observable");
			expect(tool.requires).toBeUndefined();
			expect(tool.params.map((param) => [param.name, param.required])).toEqual([
				["expected", false],
			]);
		}
	});

	test("an unknown tool names the ones that exist", async () => {
		let error = unwrapError(await PLUGIN.call("seed", [], contextFor(secondAttempt())));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('spec has no tool "seed"');
		expect(error.message).toContain("run_id, attempt, nonce");
	});

	test("run_id reports the run's identifier", async () => {
		let result = await PLUGIN.call("run_id", [], contextFor(secondAttempt()));
		expect(unwrap(result)).toBe("2026-09-10T12-00-00");
	});

	test("attempt reports a number, not its text", async () => {
		let result = await PLUGIN.call("attempt", [], contextFor(secondAttempt()));
		expect(unwrap(result)).toBe(2);
	});

	test("nonce reports the run's nonce", async () => {
		let result = await PLUGIN.call("nonce", [], contextFor(secondAttempt()));
		expect(unwrap(result)).toBe("2026-09-10T12-00-00-2");
	});

	test("the three tools agree: the nonce joins the run id and the attempt", async () => {
		let context = contextFor(secondAttempt());
		let id = unwrap(await PLUGIN.call("run_id", [], context));
		let attempt = unwrap(await PLUGIN.call("attempt", [], context));
		let nonce = unwrap(await PLUGIN.call("nonce", [], context));
		expect(nonce).toBe(`${String(id)}-${String(attempt)}`);
	});

	test("two reads within one attempt return the same nonce", async () => {
		let context = contextFor(secondAttempt());
		let first = unwrap(await PLUGIN.call("nonce", [], context));
		let second = unwrap(await PLUGIN.call("nonce", [], context));
		expect(second).toBe(first);
	});

	test("a retry of the same run moves the nonce and keeps the run id", async () => {
		let first = contextFor({ id: "run-a", attempt: 1, nonce: "run-a-1" });
		let retry = contextFor({ id: "run-a", attempt: 2, nonce: "run-a-2" });
		expect(unwrap(await PLUGIN.call("run_id", [], retry))).toBe(
			unwrap(await PLUGIN.call("run_id", [], first)),
		);
		expect(unwrap(await PLUGIN.call("nonce", [], retry))).not.toBe(
			unwrap(await PLUGIN.call("nonce", [], first)),
		);
	});

	test("an expected value that matches observes true, and one that misses fails", async () => {
		let context = contextFor(secondAttempt());
		expect(unwrap(await PLUGIN.call("attempt", [{ kind: "value", value: 2 }], context))).toBe(true);
		let error = unwrapError(await PLUGIN.call("attempt", [{ kind: "value", value: 3 }], context));
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain("spec.attempt is not 3");
	});

	test("a second argument is a tool error naming the tool", async () => {
		let context = contextFor(secondAttempt());
		for (let tool of ["run_id", "attempt", "nonce"]) {
			let error = unwrapError(
				await PLUGIN.call(
					tool,
					[
						{ kind: "value", value: "extra" },
						{ kind: "value", value: "more" },
					],
					context,
				),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain(`spec.${tool} takes at most one argument`);
		}
	});
});
