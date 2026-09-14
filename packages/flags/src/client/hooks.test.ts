/**
 * The four stages: what each one is told, the order they run in, and what
 * happens to an evaluation when one of them fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { describe, expect, test } from "vitest";

import type { EvaluationContext } from "../core/context.js";
import type { Hook, HookContext, HookHints } from "../core/hook.js";

import { resolved } from "../provider/details.js";

import { createFlags } from "./registry.js";

/** Resolves everything to its default, so only the stages around it are under test. */
class Simple {
	readonly metadata = { name: "simple" };

	hooks: Hook[] = [];

	constructor(hooks: Hook[] = []) {
		this.hooks = hooks;
	}

	resolveBoolean(_key: string, value: boolean) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveString(_key: string, value: string) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveNumber(_key: string, value: number) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveObject(_key: string, value: JSONValue) {
		return resolved(value, { reason: "STATIC" });
	}
}

/** Names every stage it runs, so one array reads as the whole life cycle. */
function tracer(name: string, log: string[]): Hook {
	return {
		before: () => void log.push(`${name}:before`),
		after: () => void log.push(`${name}:after`),
		error: () => void log.push(`${name}:error`),
		finally: () => void log.push(`${name}:finally`),
	};
}

describe("hook context", () => {
	test("Requirement 4.1.1: a stage is told the key, the type, the context, the default and its data", async () => {
		let seen: HookContext | undefined;
		let flags = createFlags({
			context: { plan: "pro" },
			hooks: [{ before: (c) => void (seen = c) }],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().number("batch-size", 50);

		expect(seen).toMatchObject({
			flagKey: "batch-size",
			flagValueType: "number",
			defaultValue: 50,
			context: { plan: "pro" },
		});
		expect(seen?.hookData).toBeInstanceOf(Map);
	});

	test("Requirement 4.1.3: the key, the type and the default value cannot be changed by a hook", async () => {
		let frozen: boolean | undefined;
		let flags = createFlags({ hooks: [{ before: (c) => void (frozen = Object.isFrozen(c)) }] });
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(frozen).toBe(true);
	});

	test("Requirement 4.1.4.1: only the before stage changes the evaluation context", async () => {
		let seen: EvaluationContext[] = [];
		let flags = createFlags({
			hooks: [
				{ before: () => ({ added: true }) },
				{
					before: (c) => void seen.push(c.context),
					after: (c) => void seen.push(c.context),
					finally: (c) => void seen.push(c.context),
				},
			],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(seen).toHaveLength(3);
		for (let context of seen) expect(context).toMatchObject({ added: true });
	});

	test("Requirement 4.1.5: hook data is mutable and survives into the later stages", async () => {
		let read: unknown;
		let flags = createFlags({
			hooks: [
				{
					before: (c) => void c.hookData.set("started", 1),
					finally: (c) => void (read = c.hookData.get("started")),
				},
			],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(read).toBe(1);
	});

	test("Requirement 4.6.1: hook data takes arbitrary keys and values of any type", async () => {
		let read: unknown;
		let payload = { nested: [1, 2, 3] };
		let flags = createFlags({
			hooks: [
				{
					before: (c) => void c.hookData.set("anything at all", payload),
					finally: (c) => void (read = c.hookData.get("anything at all")),
				},
			],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(read).toBe(payload);
	});
});

describe("hook hints", () => {
	test("Requirement 4.2.1: hints carry booleans, strings, numbers, dates and structures", async () => {
		let seen: HookHints | undefined;
		let flags = createFlags({ hooks: [{ before: (_c, hints) => void (seen = hints) }] });
		await flags.setProvider(new Simple());

		let when = new Date("2026-01-01T00:00:00.000Z");
		await flags.getClient().boolean("flag", false, undefined, {
			hints: { retry: true, caller: "checkout", attempt: 2, at: when, route: { id: "r" } },
		});

		expect(seen).toEqual({
			retry: true,
			caller: "checkout",
			attempt: 2,
			at: when,
			route: { id: "r" },
		});
	});

	test("Requirement 4.2.2.1: hook hints are immutable", async () => {
		let frozen: boolean | undefined;
		let flags = createFlags({
			hooks: [{ before: (_c, hints) => void (frozen = Object.isFrozen(hints)) }],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false, undefined, { hints: { caller: "checkout" } });

		expect(frozen).toBe(true);
	});

	test("Requirement 4.5.3: a hook cannot alter the hints structure", async () => {
		let hints: HookHints = { caller: "checkout" };
		let flags = createFlags({
			hooks: [
				{
					before(_c, given) {
						(given as Record<string, unknown>).caller = "someone else";
					},
				},
			],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false, undefined, { hints });

		expect(hints.caller).toBe("checkout");
	});

	test("Requirement 4.5.2: every hook is given the hints", async () => {
		let seen: unknown[] = [];
		let record: Hook = {
			before: (_c, hints) => void seen.push(hints.caller),
			after: (_c, _d, hints) => void seen.push(hints.caller),
			finally: (_c, _d, hints) => void seen.push(hints.caller),
		};
		let flags = createFlags({ hooks: [record] });
		await flags.setProvider(new Simple([record]));

		await flags.getClient().boolean("flag", false, undefined, { hints: { caller: "checkout" } });

		expect(seen).toEqual(["checkout", "checkout", "checkout", "checkout", "checkout", "checkout"]);
	});
});

describe("metadata on the hook context", () => {
	test("Requirement 4.2.2.2: the client metadata in the hook context is immutable", async () => {
		let frozen: boolean | undefined;
		let flags = createFlags({
			hooks: [{ before: (c) => void (frozen = Object.isFrozen(c.clientMetadata)) }],
		});
		await flags.setProvider(new Simple());

		await flags.getClient("checkout").boolean("flag", false);

		expect(frozen).toBe(true);
	});

	test("Requirement 4.2.2.3: the provider metadata in the hook context is immutable", async () => {
		let frozen: boolean | undefined;
		let flags = createFlags({
			hooks: [{ before: (c) => void (frozen = Object.isFrozen(c.providerMetadata)) }],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(frozen).toBe(true);
	});
});

describe("the stages", () => {
	test("Requirement 4.3.1: a hook declaring one stage runs that stage alone", async () => {
		let ran = 0;
		let flags = createFlags({ hooks: [{ finally: () => void ran++ }] });
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(ran).toBe(1);
	});

	test("Requirement 4.3.2: hook data is per hook per evaluation and is never shared", async () => {
		let seen: unknown[] = [];
		let first: Hook = {
			before: (c) => void c.hookData.set("mine", "first"),
			finally: (c) => void seen.push(c.hookData.get("mine")),
		};
		let second: Hook = {
			before: (c) => void seen.push(c.hookData.get("mine")),
			finally: (c) => void seen.push(c.hookData.size),
		};
		let flags = createFlags({ hooks: [first, second] });
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);
		await flags.getClient().boolean("flag", false);

		expect(seen).toEqual([undefined, 0, "first", undefined, 0, "first"]);
	});

	test("Requirement 4.3.2.1: the before stage runs before resolution and may return a context", async () => {
		let order: string[] = [];
		let flags = createFlags({ hooks: [{ before: () => void order.push("before") }] });
		await flags.setProvider({
			metadata: { name: "ordered" },
			resolveBoolean: (_k: string, value: boolean) => {
				order.push("resolve");
				return resolved(value);
			},
			resolveString: (_k: string, value: string) => resolved(value),
			resolveNumber: (_k: string, value: number) => resolved(value),
			resolveObject: (_k: string, value: JSONValue) => resolved(value),
		});

		await flags.getClient().boolean("flag", false);

		expect(order).toEqual(["before", "resolve"]);
	});

	test("Requirement 4.3.4: a context returned by a before hook reaches the next before hook", async () => {
		let seen: EvaluationContext | undefined;
		let flags = createFlags({
			hooks: [{ before: () => ({ fromFirst: true }) }, { before: (c) => void (seen = c.context) }],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(seen).toMatchObject({ fromFirst: true });
	});

	test("Requirement 4.3.5: what the before hooks returned is merged into the context the provider sees", async () => {
		let seen: EvaluationContext | undefined;
		let flags = createFlags({
			context: { plan: "free" },
			hooks: [{ before: () => ({ plan: "pro", extra: 1 }) }],
		});
		await flags.setProvider({
			metadata: { name: "watcher" },
			resolveBoolean: (_k: string, value: boolean, context: EvaluationContext) => {
				seen = context;
				return resolved(value);
			},
			resolveString: (_k: string, value: string) => resolved(value),
			resolveNumber: (_k: string, value: number) => resolved(value),
			resolveObject: (_k: string, value: JSONValue) => resolved(value),
		});

		await flags.getClient().boolean("flag", false);

		expect(seen).toEqual({ plan: "pro", extra: 1 });
	});

	test("Requirement 4.3.6: the after stage runs after resolution with the evaluation details", async () => {
		let seen: unknown;
		let flags = createFlags({ hooks: [{ after: (_c, details) => void (seen = details) }] });
		await flags.setProvider(new Simple());

		await flags.getClient().string("copy", "hello");

		expect(seen).toMatchObject({ flagKey: "copy", value: "hello", reason: "STATIC" });
	});

	test("Requirement 4.3.7: the error stage runs when resolution fails", async () => {
		let seen: unknown;
		let flags = createFlags({ hooks: [{ error: (_c, error) => void (seen = error) }] });
		await flags.setProvider({
			metadata: { name: "broken" },
			resolveBoolean(): never {
				throw new Error("no answer");
			},
			resolveString: (_k: string, value: string) => resolved(value),
			resolveNumber: (_k: string, value: number) => resolved(value),
			resolveObject: (_k: string, value: JSONValue) => resolved(value),
		});

		await flags.getClient().boolean("flag", false);

		expect(seen).toBeInstanceOf(Error);
	});

	test("Requirement 4.3.8: the finally stage runs after the other three", async () => {
		let log: string[] = [];
		let flags = createFlags({ hooks: [tracer("only", log)] });
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(log).toEqual(["only:before", "only:after", "only:finally"]);
	});
});

describe("hook ordering", () => {
	test("Requirement 4.4.1: the API, the client, the invocation and the provider each register hooks", async () => {
		let log: string[] = [];
		let flags = createFlags({ hooks: [tracer("api", log)] });
		await flags.setProvider(new Simple([tracer("provider", log)]));

		let client = flags.getClient();
		client.addHooks(tracer("client", log));

		await client.boolean("flag", false, undefined, { hooks: [tracer("invocation", log)] });

		expect(log.filter((entry) => entry.endsWith(":before"))).toEqual([
			"api:before",
			"client:before",
			"invocation:before",
			"provider:before",
		]);
	});

	test("Requirement 4.4.2: before runs API, client, invocation, provider; the rest run in reverse", async () => {
		let log: string[] = [];
		let flags = createFlags({ hooks: [tracer("api", log)] });
		await flags.setProvider(new Simple([tracer("provider", log)]));

		let client = flags.getClient();
		client.addHooks(tracer("client", log));

		await client.boolean("flag", false, undefined, { hooks: [tracer("invocation", log)] });

		expect(log).toEqual([
			"api:before",
			"client:before",
			"invocation:before",
			"provider:before",
			"provider:after",
			"invocation:after",
			"client:after",
			"api:after",
			"provider:finally",
			"invocation:finally",
			"client:finally",
			"api:finally",
		]);
	});

	test("Requirement 4.4.3: a finally hook that throws leaves the remaining ones running", async () => {
		let log: string[] = [];
		let flags = createFlags({
			hooks: [
				{ finally: () => void log.push("first") },
				{
					finally() {
						throw new Error("noisy");
					},
				},
				{ finally: () => void log.push("third") },
			],
		});
		await flags.setProvider(new Simple());

		expect(await flags.getClient().boolean("flag", true)).toBe(true);
		expect(log).toEqual(["third", "first"]);
	});

	test("Requirement 4.4.4: an error hook that throws leaves the remaining ones running", async () => {
		let log: string[] = [];
		let flags = createFlags({
			hooks: [
				{ error: () => void log.push("first") },
				{
					error() {
						throw new Error("noisy");
					},
				},
				{ error: () => void log.push("third") },
				{
					before() {
						throw new Error("the evaluation fails here");
					},
				},
			],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(log).toEqual(["third", "first"]);
	});

	test("Requirement 4.4.5: an error in the before or after stage invokes the error hooks", async () => {
		let log: string[] = [];
		let failing = (stage: "before" | "after"): Hook => ({
			[stage]() {
				throw new Error(`${stage} failed`);
			},
			error: (_c, error) => void log.push((error as Error).message),
		});

		for (let stage of ["before", "after"] as const) {
			let flags = createFlags({ hooks: [failing(stage)] });
			await flags.setProvider(new Simple());
			await flags.getClient().boolean("flag", false);
		}

		expect(log).toEqual(["before failed", "after failed"]);
	});

	test("Requirement 4.4.6: an error in a before hook stops the remaining before hooks", async () => {
		let log: string[] = [];
		let flags = createFlags({
			hooks: [
				{ before: () => void log.push("first") },
				{
					before() {
						throw new Error("stop here");
					},
				},
				{ before: () => void log.push("third") },
			],
		});
		await flags.setProvider(new Simple());

		await flags.getClient().boolean("flag", false);

		expect(log).toEqual(["first"]);
	});

	test("Requirement 4.4.7: an error in a before hook returns the default value", async () => {
		let flags = createFlags({
			hooks: [
				{
					before() {
						throw new Error("stop here");
					},
				},
			],
		});
		await flags.setProvider(new Simple());

		expect(await flags.getClient().boolean("flag", true)).toBe(true);
		expect(await flags.getClient().booleanDetails("flag", true)).toMatchObject({
			value: true,
			reason: "ERROR",
			errorCode: "GENERAL",
		});
	});
});

describe("provider hooks", () => {
	test("Requirement 2.3.1: a provider's own hooks run for every evaluation it answers", async () => {
		let log: string[] = [];
		let flags = createFlags();
		await flags.setProvider(new Simple([tracer("provider", log)]));

		await flags.getClient().boolean("flag", false);

		expect(log).toEqual(["provider:before", "provider:after", "provider:finally"]);
	});
});
