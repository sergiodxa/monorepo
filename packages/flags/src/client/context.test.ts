/**
 * The merge order every evaluation goes through, and the transaction level that
 * makes it five levels rather than four.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { describe, expect, test } from "vitest";

import type { EvaluationContext } from "../core/context.js";
import type { ResolutionDetails } from "../core/details.js";

import { resolved } from "../provider/details.js";

import { merge } from "./context.js";
import { asyncLocalStoragePropagator } from "./propagator.js";
import { createFlags } from "./registry.js";

/** Answers anything with its default, keeping whatever context it was handed. */
class Recorder {
	readonly metadata = { name: "recorder" };

	seen: EvaluationContext = {};

	resolveBoolean(_key: string, value: boolean, context: EvaluationContext) {
		this.seen = context;
		return resolved(value);
	}
	resolveString(_key: string, value: string, context: EvaluationContext) {
		this.seen = context;
		return resolved(value);
	}
	resolveNumber(_key: string, value: number, context: EvaluationContext) {
		this.seen = context;
		return resolved(value);
	}
	resolveObject(_key: string, value: JSONValue, context: EvaluationContext) {
		this.seen = context;
		return resolved(value) as ResolutionDetails<JSONValue>;
	}
}

describe("evaluation context", () => {
	test("Requirement 3.1.1: the targeting key reaches the provider as a string field", async () => {
		let provider = new Recorder();
		let flags = createFlags();
		await flags.setProvider(provider);

		await flags.getClient().boolean("flag", false, { targetingKey: "user-1" });

		expect(provider.seen.targetingKey).toBe("user-1");
	});

	test("Requirement 3.1.2: custom fields carry booleans, strings, numbers, dates and structures", async () => {
		let provider = new Recorder();
		let flags = createFlags();
		await flags.setProvider(provider);

		let when = new Date("2026-01-01T00:00:00.000Z");
		await flags.getClient().boolean("flag", false, {
			beta: true,
			plan: "pro",
			seats: 12,
			since: when,
			team: { id: "t" },
		});

		expect(provider.seen).toMatchObject({
			beta: true,
			plan: "pro",
			seats: 12,
			since: when,
			team: { id: "t" },
		});
	});

	test("Requirement 3.1.3: the merged context reads by key and as whole pairs", () => {
		let context = merge({ plan: "pro" }, { seats: 3 });

		expect(context.plan).toBe("pro");
		expect(Object.entries(context)).toEqual([
			["plan", "pro"],
			["seats", 3],
		]);
	});

	test("Requirement 3.1.4: a field set twice is one field", () => {
		let context = merge({ plan: "free" }, { plan: "pro" });

		expect(Object.keys(context)).toEqual(["plan"]);
		expect(context.plan).toBe("pro");
	});

	test("Requirement 3.2.1.1: the API, the client and the invocation each supply context", async () => {
		let provider = new Recorder();
		let flags = createFlags({ context: { fromApi: true } });
		await flags.setProvider(provider);

		await flags.getClient(undefined, { fromClient: true }).boolean("flag", false, {
			fromInvocation: true,
		});

		expect(provider.seen).toMatchObject({
			fromApi: true,
			fromClient: true,
			fromInvocation: true,
		});
	});

	test("Requirement 3.2.3: API, transaction, client, invocation and before hooks merge in that order", async () => {
		let provider = new Recorder();
		let flags = createFlags({
			context: { targetingKey: "api", level: "api", api: true },
			propagator: asyncLocalStoragePropagator(),
			hooks: [{ before: () => ({ targetingKey: "hook", level: "hook", hook: true }) }],
		});
		await flags.setProvider(provider);

		let client = flags.getClient(undefined, {
			targetingKey: "client",
			level: "client",
			client: true,
		});

		await flags.setTransactionContext(
			{ targetingKey: "transaction", level: "transaction", transaction: true },
			() =>
				client.boolean("flag", false, {
					targetingKey: "invocation",
					level: "invocation",
					invocation: true,
				}),
		);

		expect(provider.seen).toEqual({
			targetingKey: "hook",
			level: "hook",
			api: true,
			transaction: true,
			client: true,
			invocation: true,
			hook: true,
		});
	});

	test("Requirement 3.3.1.2.1: the API sets the transaction context for the work inside it", async () => {
		let provider = new Recorder();
		let flags = createFlags({ propagator: asyncLocalStoragePropagator() });
		await flags.setProvider(provider);

		await flags.setTransactionContext({ targetingKey: "in-transaction" }, () =>
			flags.getClient().boolean("flag", false),
		);
		expect(provider.seen.targetingKey).toBe("in-transaction");

		await flags.getClient().boolean("flag", false);
		expect(provider.seen.targetingKey).toBeUndefined();
	});

	test("Requirement 3.3.1.2.2: a propagator sets the context of the current transaction", () => {
		let propagator = asyncLocalStoragePropagator();

		let inside = propagator.setTransactionContext({ targetingKey: "set" }, () =>
			propagator.getTransactionContext(),
		);

		expect(inside).toEqual({ targetingKey: "set" });
	});

	test("Requirement 3.3.1.2.3: a propagator gets the context of the current transaction", () => {
		let propagator = asyncLocalStoragePropagator();

		expect(propagator.getTransactionContext()).toBeUndefined();
		propagator.setTransactionContext({ plan: "pro" }, () => {
			expect(propagator.getTransactionContext()).toEqual({ plan: "pro" });
		});
	});
});
