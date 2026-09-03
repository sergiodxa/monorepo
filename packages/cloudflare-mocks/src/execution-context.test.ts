/**
 * Tests for the execution context mock: work handed to `waitUntil` is recorded for
 * later awaiting, `settled()` drains work registered while draining, and a rejected
 * background promise surfaces through `settled()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createExecutionContext } from "./execution-context.js";

describe("createExecutionContext", () => {
	test("records the promises handed to waitUntil", () => {
		let ctx = createExecutionContext();
		let promise = Promise.resolve("done");

		ctx.waitUntil(promise);

		expect(ctx.waitUntilPromises).toEqual([promise]);
	});

	test("awaits every registered promise", async () => {
		let ctx = createExecutionContext();
		let written: string[] = [];

		ctx.waitUntil(Promise.resolve().then(() => void written.push("first")));
		ctx.waitUntil(Promise.resolve().then(() => void written.push("second")));

		await ctx.settled();

		expect(written).toEqual(["first", "second"]);
	});

	test("drains work registered while draining", async () => {
		let ctx = createExecutionContext();
		let written: string[] = [];

		ctx.waitUntil(
			Promise.resolve().then(() => {
				written.push("outer");
				ctx.waitUntil(Promise.resolve().then(() => void written.push("inner")));
			}),
		);

		await ctx.settled();

		expect(written).toEqual(["outer", "inner"]);
	});

	test("surfaces a rejected background promise", async () => {
		let ctx = createExecutionContext();
		let boom = new Error("background failed");

		ctx.waitUntil(Promise.reject(boom));

		await expect(ctx.settled()).rejects.toBe(boom);
	});

	test("resolves immediately when nothing was registered", async () => {
		let ctx = createExecutionContext();

		await ctx.settled();

		expect(ctx.waitUntilPromises).toHaveLength(0);
	});

	test("records passThroughOnException", () => {
		let ctx = createExecutionContext();

		expect(ctx.passedThroughOnException).toBe(false);
		ctx.passThroughOnException();
		expect(ctx.passedThroughOnException).toBe(true);
	});

	test("records abort and the reason it was given", () => {
		let ctx = createExecutionContext();
		let reason = new Error("client went away");

		expect(ctx.aborted).toBe(false);
		ctx.abort(reason);

		expect(ctx.aborted).toBe(true);
		expect(ctx.abortReason).toBe(reason);
	});

	test("records an abort that was given no reason", () => {
		let ctx = createExecutionContext();

		ctx.abort();

		expect(ctx.aborted).toBe(true);
		expect(ctx.abortReason).toBeUndefined();
	});

	test("keeps the first reason when aborted more than once", () => {
		let ctx = createExecutionContext();

		ctx.abort("first");
		ctx.abort("second");

		expect(ctx.abortReason).toBe("first");
	});

	test("exposes the props it was given", () => {
		let ctx = createExecutionContext<{ tenant: string }>({ props: { tenant: "acme" } });

		expect(ctx.props).toEqual({ tenant: "acme" });
	});

	test("fails loudly when unimplemented platform surfaces are read", () => {
		let ctx = createExecutionContext();

		expect(() => ctx.exports).toThrow(/not implemented/);
		expect(() => ctx.tracing).toThrow(/not implemented/);
	});

	test("gives every context its own isolated record", () => {
		let first = createExecutionContext();
		let second = createExecutionContext();

		first.waitUntil(Promise.resolve());

		expect(second.waitUntilPromises).toHaveLength(0);
	});
});
