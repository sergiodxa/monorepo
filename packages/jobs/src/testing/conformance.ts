/**
 * The suite that says what a job queue is, registered as Vitest tests against whatever the
 * caller constructs. Every adapter runs it, which is what makes one a substitute for another
 * rather than something that merely resembles it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JobDelivery, JobQueue, JobQueueError, Settlement } from "../queue.js";

/** Deliveries a claim asks for, high enough that a test never has to claim twice for one message. */
const CLAIM_LIMIT = 10;

/** How long a claim holds what it took, long enough that nothing expires mid-test. */
const CLAIM_LEASE = "30 seconds";

/** The delay the clock tests hold a message for, and the same length in the unit `advance` counts. */
const DELAY = "1 minute";
const DELAY_MS = 60_000;

/** What the suite needs to exercise an adapter. */
export interface ConformanceOptions<Queue extends JobQueue = JobQueue> {
	/** Adapter name, which labels the registered suite. */
	name: string;

	/**
	 * Builds the queue under test. It is called for every test, so an adapter holding mutable
	 * state starts each one clean. It answers synchronously because the suite reads `claim` off
	 * a queue while registering, and a `describe` body cannot await.
	 */
	create: () => Queue;

	/**
	 * Every body still waiting on the queue, parsed, oldest first. The port has no read of its
	 * own — a backend either exposes what it holds or records into a binding mock — so the
	 * caller is the one that can answer this.
	 */
	messages: (queue: Queue) => unknown[] | Promise<unknown[]>;

	/**
	 * Moves the adapter's clock forward in milliseconds, which is what a delay assertion needs.
	 * An adapter that can only pass a delay in real time leaves it out, and the suite registers
	 * the delay tests against the adapters that can.
	 */
	advance?: (ms: number) => void | Promise<void>;

	/**
	 * A delay longer than this backend holds a message for. Supplying it registers the ceiling
	 * assertions, which is what states that the backend refuses such a delay rather than
	 * shortening one job's three days into fifteen minutes.
	 */
	unsupportedDelay?: DurationInput;
}

/**
 * Registers the suite every job queue has to pass.
 *
 * @param options The adapter under test.
 */
export function conformance<Queue extends JobQueue>({
	name,
	create,
	messages,
	advance,
	unsupportedDelay,
}: ConformanceOptions<Queue>): void {
	/** The error a call answered with, asserting that it answered with one. */
	let errorOf = <T>(result: Result<T, JobQueueError>): JobQueueError => {
		if (isSuccess(result)) throw new Error("expected a failure, got a success");
		return result.error;
	};

	/** Takes everything claimable, failing loudly if a pull test reached a pushed backend. */
	let claim = async (queue: Queue): Promise<JobDelivery[]> => {
		if (queue.claim === undefined) throw new Error(`${name} has no claim()`);
		return unwrap(await queue.claim({ limit: CLAIM_LIMIT, lease: CLAIM_LEASE }));
	};

	/** Applies one ending, failing loudly if a pull test reached a pushed backend. */
	let settle = async (
		queue: Queue,
		delivery: JobDelivery,
		settlement: Settlement,
	): Promise<void> => {
		if (queue.settle === undefined) throw new Error(`${name} has no settle()`);
		unwrap(await queue.settle(delivery, settlement));
	};

	describe(`${name} conformance`, () => {
		test("reads a sent message back as the envelope its job is addressed by", async () => {
			let queue = create();

			unwrap(await queue.send([{ job: "checkHttp", body: { monitorId: "m1" } }]));

			expect(await messages(queue)).toStrictEqual([
				{ job: "checkHttp", body: { monitorId: "m1" } },
			]);
		});

		test("carries no body for a job that has no payload", async () => {
			let queue = create();

			unwrap(await queue.send([{ job: "clean" }]));

			expect(await messages(queue)).toStrictEqual([{ job: "clean" }]);
		});

		test("enqueues every message of a list, in the order they were given", async () => {
			let queue = create();

			unwrap(await queue.send([{ job: "first" }, { job: "second" }, { job: "third" }]));

			expect(await messages(queue)).toStrictEqual([
				{ job: "first" },
				{ job: "second" },
				{ job: "third" },
			]);
		});

		test("does nothing when it is given nothing to enqueue", async () => {
			let queue = create();

			unwrap(await queue.send([]));

			expect(await messages(queue)).toStrictEqual([]);
		});

		test("states who counts its retries", async () => {
			let queue = create();

			expect(["backend", "core"]).toContain(queue.retries);
		});

		if (unsupportedDelay !== undefined) {
			test("reports a delay past its ceiling as unsupported_delay", async () => {
				let queue = create();

				let error = errorOf(await queue.send([{ job: "clean", delay: unsupportedDelay }]));

				expect(error.code).toBe("unsupported_delay");
			});

			test("enqueues nothing when it refuses a delay, rather than shortening it", async () => {
				let queue = create();

				errorOf(
					await queue.send([{ job: "checkHttp" }, { job: "clean", delay: unsupportedDelay }]),
				);

				expect(await messages(queue)).toStrictEqual([]);
			});
		}

		/**
		 * Read off a queue built while registering: `claim` and `settle` are present together on a
		 * pulled backend and absent on one that pushes, and only the pulled groups below can be
		 * stated at all against a backend that hands nothing over.
		 */
		let pulled = create().claim !== undefined;

		if (!pulled) return;

		test("counts the attempts of a claimed delivery from one", async () => {
			let queue = create();
			unwrap(await queue.send([{ job: "clean" }]));

			let claimed = await claim(queue);

			expect(claimed).toHaveLength(1);
			expect(claimed[0]?.attempts).toBe(1);
		});

		test("holds a claimed delivery, so a second claim does not see it", async () => {
			let queue = create();
			unwrap(await queue.send([{ job: "clean" }]));

			await claim(queue);

			expect(await claim(queue)).toStrictEqual([]);
		});

		test("removes an acked delivery", async () => {
			let queue = create();
			unwrap(await queue.send([{ job: "clean" }]));
			let [delivery] = await claim(queue);
			if (delivery === undefined) throw new Error("claim handed nothing over");

			await settle(queue, delivery, { type: "ack" });

			expect(await messages(queue)).toStrictEqual([]);
			expect(await claim(queue)).toStrictEqual([]);
		});

		test("returns a retried delivery to the queue for another attempt", async () => {
			let queue = create();
			unwrap(await queue.send([{ job: "clean" }]));
			let [delivery] = await claim(queue);
			if (delivery === undefined) throw new Error("claim handed nothing over");

			await settle(queue, delivery, { type: "retry", delay: 0 });

			expect(await messages(queue)).toStrictEqual([{ job: "clean" }]);
			let redelivered = await claim(queue);
			expect(redelivered).toHaveLength(1);
			expect(redelivered[0]?.attempts).toBe(2);
		});

		test("removes a dead-lettered delivery without redelivering it", async () => {
			let queue = create();
			unwrap(await queue.send([{ job: "clean" }]));
			let [delivery] = await claim(queue);
			if (delivery === undefined) throw new Error("claim handed nothing over");

			await settle(queue, delivery, { type: "dead-letter", reason: "retries_exhausted" });

			expect(await messages(queue)).toStrictEqual([]);
			expect(await claim(queue)).toStrictEqual([]);
		});

		if (advance === undefined) return;

		test("withholds a delayed message until its delay has passed", async () => {
			let queue = create();
			unwrap(await queue.send([{ job: "clean", delay: DELAY }]));

			expect(await claim(queue)).toStrictEqual([]);
			await advance(DELAY_MS);

			expect(await claim(queue)).toHaveLength(1);
		});

		test("keeps a delayed message withheld until the whole delay has passed", async () => {
			let queue = create();
			unwrap(await queue.send([{ job: "clean", delay: DELAY }]));

			await advance(DELAY_MS - 1);

			expect(await claim(queue)).toStrictEqual([]);
		});
	});
}
