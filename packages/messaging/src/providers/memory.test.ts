/**
 * Exercises `MemoryDestination`: it records successful calls, fails on cue, declares
 * only the capabilities asked for, and passes the conformance suite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Message } from "../message.js";

import { describeDestination } from "../conformance.js";
import { supports } from "../destination.js";

import { MemoryDestination } from "./memory.js";

const MESSAGE: Message = { title: "api.example.com is down", severity: "critical" };

/** The instance the conformance suite last created, so `rateLimitNext` scripts it. */
let current = new MemoryDestination();

describeDestination({
	name: "MemoryDestination",
	capabilities: ["update", "reply"],
	create: () => (current = new MemoryDestination({ capabilities: ["update", "reply"] })),
	rateLimitNext: (delayMs) => current.failNext({ code: "rate-limited", retryAfter: delayMs }),
});

describeDestination({
	name: "MemoryDestination without capabilities",
	capabilities: [],
	create: () => (current = new MemoryDestination()),
	rateLimitNext: (delayMs) => current.failNext({ code: "rate-limited", retryAfter: delayMs }),
});

describe("MemoryDestination", () => {
	test("fails on cue, then records the next message", async () => {
		let destination = new MemoryDestination({ capabilities: ["update"] });
		destination.failNext({ code: "rate-limited", retryAfter: 30_000 });

		let first = await destination.send(MESSAGE);
		let second = await destination.send(MESSAGE);

		expect(isFailure(first) && first.error.retryable).toBe(true);
		expect(isFailure(first) && first.error.retryAfter).toBe(30_000);
		expect(isSuccess(second) && second.data.ref).toEqual({ provider: "memory", id: "1" });
		expect(destination.messages).toHaveLength(1);
		expect(destination.last?.message.severity).toBe("critical");
	});

	test("declares only the capabilities it was given", () => {
		let destination = new MemoryDestination({ capabilities: ["reply"] });
		expect(supports(destination, "reply")).toBe(true);
		expect(supports(destination, "update")).toBe(false);
	});

	test("records a reply under the message it answers", async () => {
		let destination = new MemoryDestination({ capabilities: ["reply"] });
		let sent = await destination.send(MESSAGE);
		if (!isSuccess(sent) || !sent.data.ref || !supports(destination, "reply")) throw new Error();

		await destination.reply(sent.data.ref, { title: "Recovered" });

		expect(destination.last).toMatchObject({ kind: "reply", parent: sent.data.ref });
	});

	test("refuses a ref to a message it never sent", async () => {
		let destination = new MemoryDestination({ capabilities: ["update"] });
		if (!supports(destination, "update")) throw new Error();
		let updated = await destination.update({ provider: "memory", id: "9" }, MESSAGE);
		expect(isFailure(updated) && updated.error.code).toBe("invalid-ref");
	});
});
