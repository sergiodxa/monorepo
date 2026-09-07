/**
 * Exercises the memory queue against the port it implements: the envelope it writes, the
 * lease a claim takes, what each settlement does to a held delivery, and the delay an
 * injectable clock lets a test pass without waiting for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Settlement } from "../queue.js";

import { queue } from "./memory.js";

/** A queue whose clock a test moves, starting at a fixed instant. */
function setup() {
	let now = 1_000_000;
	let memory = queue({ now: () => now });

	return {
		memory,
		/** Moves the clock forward, which is what a delay needs to pass. */
		advance: (ms: number) => void (now += ms),
	};
}

/** Claims everything ready, with a lease long enough that nothing expires mid-test. */
function claimAll(memory: ReturnType<typeof setup>["memory"]) {
	return memory.claim?.({ limit: 100, lease: "30 seconds" });
}

describe("send()", () => {
	test("writes the envelope the job is addressed by", async () => {
		let { memory } = setup();

		unwrap(await memory.send([{ job: "checkHttp", body: { monitorId: "m1" } }]));

		expect(memory.messages).toEqual([{ job: "checkHttp", body: { monitorId: "m1" } }]);
	});

	test("writes no body for a job that carries no payload", async () => {
		let { memory } = setup();

		unwrap(await memory.send([{ job: "clean" }]));

		expect(memory.messages).toEqual([{ job: "clean" }]);
	});

	test("serializes what it holds, so a Date reads back as a remote store would answer", async () => {
		let { memory } = setup();

		unwrap(await memory.send([{ job: "clean", body: { at: new Date(0).toISOString() } }]));

		expect(memory.messages).toEqual([{ job: "clean", body: { at: "1970-01-01T00:00:00.000Z" } }]);
	});

	test("counts its own retries, so a dispatcher's maxAttempts decides", () => {
		let { memory } = setup();

		expect(memory.retries).toBe("core");
	});
});

describe("claim()", () => {
	test("counts an attempt per delivery, from one", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "clean" }]));

		let claimed = unwrap((await claimAll(memory))!);

		expect(claimed).toHaveLength(1);
		expect(claimed[0]?.attempts).toBe(1);
	});

	test("holds what it handed over, so a second claim sees none of it", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "clean" }]));

		unwrap((await claimAll(memory))!);
		let second = unwrap((await claimAll(memory))!);

		expect(second).toEqual([]);
	});

	test("hands a held delivery over again once its lease expires", async () => {
		let { memory, advance } = setup();
		unwrap(await memory.send([{ job: "clean" }]));

		unwrap((await memory.claim?.({ limit: 100, lease: "5 seconds" }))!);
		advance(6000);
		let again = unwrap((await claimAll(memory))!);

		expect(again).toHaveLength(1);
		expect(again[0]?.attempts).toBe(2);
	});

	test("hands over no more than the limit asked for", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "clean" }, { job: "clean" }, { job: "clean" }]));

		let claimed = unwrap((await memory.claim?.({ limit: 2, lease: "30 seconds" }))!);

		expect(claimed).toHaveLength(2);
	});

	test("withholds a delayed message until its delay has passed", async () => {
		let { memory, advance } = setup();
		unwrap(await memory.send([{ job: "clean", delay: "5 minutes" }]));

		expect(unwrap((await claimAll(memory))!)).toEqual([]);

		advance(5 * 60 * 1000);

		expect(unwrap((await claimAll(memory))!)).toHaveLength(1);
	});
});

describe("settle()", () => {
	test("takes an acked delivery off the queue", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "clean" }]));
		let [delivery] = unwrap((await claimAll(memory))!);

		unwrap((await memory.settle?.(delivery!, { type: "ack" }))!);

		expect(memory.messages).toEqual([]);
		expect(memory.deadLettered).toEqual([]);
	});

	test("returns a retried delivery to the queue, held for the delay it asked for", async () => {
		let { memory, advance } = setup();
		unwrap(await memory.send([{ job: "clean" }]));
		let [delivery] = unwrap((await claimAll(memory))!);

		unwrap((await memory.settle?.(delivery!, { type: "retry", delay: "1 minute" }))!);

		expect(memory.messages).toHaveLength(1);
		expect(unwrap((await claimAll(memory))!)).toEqual([]);

		advance(60_000);

		expect(unwrap((await claimAll(memory))!)).toHaveLength(1);
	});

	test("moves a dead-lettered delivery to its own list", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "clean" }]));
		let [delivery] = unwrap((await claimAll(memory))!);

		unwrap(
			(await memory.settle?.(delivery!, { type: "dead-letter", reason: "retries_exhausted" }))!,
		);

		expect(memory.messages).toEqual([]);
		expect(memory.deadLettered).toEqual([{ job: "clean" }]);
	});
});

describe("drain()", () => {
	test("answers with what each delivery ended as, in order", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "first" }, { job: "second" }]));

		let seen: string[] = [];
		let settled = await memory.drain((delivery) => {
			seen.push((delivery.body as { job: string }).job);
			return Promise.resolve<Settlement>({ type: "ack" });
		});

		expect(seen).toEqual(["first", "second"]);
		expect(settled).toEqual([{ type: "ack" }, { type: "ack" }]);
		expect(memory.messages).toEqual([]);
	});

	test("applies each settlement, so a retried delivery stays and an acked one does not", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "keep" }, { job: "drop" }]));

		await memory.drain((delivery) => {
			let named = (delivery.body as { job: string }).job;
			return Promise.resolve<Settlement>(
				named === "keep" ? { type: "retry", delay: "1 minute" } : { type: "ack" },
			);
		});

		expect(memory.messages).toEqual([{ job: "keep" }]);
	});

	test("runs nothing on an empty queue", async () => {
		let { memory } = setup();

		expect(await memory.drain(() => Promise.resolve<Settlement>({ type: "ack" }))).toEqual([]);
	});

	test("leaves a delayed message for a later drain", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "later", delay: "5 minutes" }]));

		let settled = await memory.drain(() => Promise.resolve<Settlement>({ type: "ack" }));

		expect(settled).toEqual([]);
		expect(memory.messages).toEqual([{ job: "later" }]);
	});
});

describe("reset()", () => {
	test("empties the queue and its dead-letter list", async () => {
		let { memory } = setup();
		unwrap(await memory.send([{ job: "clean" }]));
		let [delivery] = unwrap((await claimAll(memory))!);
		unwrap((await memory.settle?.(delivery!, { type: "dead-letter", reason: "invalid_message" }))!);
		unwrap(await memory.send([{ job: "clean" }]));

		memory.reset();

		expect(memory.messages).toEqual([]);
		expect(memory.deadLettered).toEqual([]);
	});
});
