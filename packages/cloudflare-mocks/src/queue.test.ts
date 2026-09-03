/**
 * Tests for the queue mock: what a producer recorded, and the `ack`/`retry` rules a
 * consumer depends on — implicit ack on success, retry of everything unacked when the
 * handler throws, and dead-lettering once the retry budget is spent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createExecutionContext } from "./execution-context.js";
import { createQueue } from "./queue.js";

/** Body shape used throughout these tests. */
interface Job {
	/** Job discriminator. */
	type: string;
}

describe("createQueue", () => {
	test("records a send with its body, id, and timestamp", async () => {
		let queue = createQueue<Job>();
		let response = await queue.send({ type: "check-http" });

		expect(queue.messages).toHaveLength(1);
		expect(queue.messages[0]?.body).toEqual({ type: "check-http" });
		expect(queue.messages[0]?.id).toBeTypeOf("string");
		expect(queue.messages[0]?.timestamp).toBeInstanceOf(Date);
		expect(response.metadata.metrics.backlogCount).toBe(1);
	});

	test("records the content type and delay a producer asked for", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" }, { contentType: "json", delaySeconds: 30 });

		expect(queue.messages[0]?.contentType).toBe("json");
		expect(queue.messages[0]?.delaySeconds).toBe(30);
	});

	test("records every message of a batch, applying the batch delay as a default", async () => {
		let queue = createQueue<Job>();
		await queue.sendBatch([{ body: { type: "a" } }, { body: { type: "b" }, delaySeconds: 5 }], {
			delaySeconds: 60,
		});

		expect(queue.messages.map((message) => message.body.type)).toEqual(["a", "b"]);
		expect(queue.messages[0]?.delaySeconds).toBe(60);
		expect(queue.messages[1]?.delaySeconds).toBe(5);
	});

	test("reports backlog metrics", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });

		let metrics = await queue.metrics();

		expect(metrics.backlogCount).toBe(1);
		expect(metrics.backlogBytes).toBeGreaterThan(0);
		expect(metrics.oldestMessageTimestamp).toBeInstanceOf(Date);
	});

	test("delivers pending messages to a consumer handler", async () => {
		let queue = createQueue<Job>({ name: "jobs" });
		await queue.send({ type: "a" });
		await queue.send({ type: "b" });

		let seen: string[] = [];

		let result = await queue.consume((batch) => {
			expect(batch.queue).toBe("jobs");
			for (let message of batch.messages) {
				expect(message.attempts).toBe(1);
				seen.push(message.body.type);
			}
		});

		expect(seen).toEqual(["a", "b"]);
		expect(result.acked).toHaveLength(2);
		expect(queue.messages).toHaveLength(0);
	});

	test("acks a message the handler left untouched", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });

		let result = await queue.consume(() => undefined);

		expect(result.acked).toHaveLength(1);
		expect(result.retried).toHaveLength(0);
		expect(queue.messages).toHaveLength(0);
	});

	test("requeues a retried message with an incremented attempt count", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });

		let first = await queue.consume((batch) => {
			batch.messages[0]?.retry();
		});

		expect(first.retried).toHaveLength(1);
		expect(queue.messages).toHaveLength(1);

		let attempts: number[] = [];
		await queue.consume((batch) => {
			for (let message of batch.messages) attempts.push(message.attempts);
		});

		expect(attempts).toEqual([2]);
	});

	test("keeps an explicitly acked message even when the rest of the batch retries", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "keep" });
		await queue.send({ type: "again" });

		let result = await queue.consume((batch) => {
			batch.messages[0]?.ack();
			batch.messages[1]?.retry();
		});

		expect(result.acked.map((record) => record.body.type)).toEqual(["keep"]);
		expect(queue.messages.map((message) => message.body.type)).toEqual(["again"]);
	});

	test("retries the whole batch through retryAll", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });
		await queue.send({ type: "b" });

		await queue.consume((batch) => {
			batch.retryAll();
		});

		expect(queue.messages).toHaveLength(2);
	});

	test("acks the whole batch through ackAll, overriding an earlier retry", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });

		await queue.consume((batch) => {
			batch.messages[0]?.retry();
			batch.ackAll();
		});

		expect(queue.messages).toHaveLength(0);
	});

	test("retries every unacked message when the handler throws, and rethrows", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "keep" });
		await queue.send({ type: "again" });

		let boom = new Error("handler failed");

		let promise = queue.consume((batch) => {
			batch.messages[0]?.ack();
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);

		expect(queue.messages.map((message) => message.body.type)).toEqual(["again"]);
	});

	test("dead-letters a message once its retry budget is spent", async () => {
		let queue = createQueue<Job>({ maxRetries: 1 });
		await queue.send({ type: "a" });

		await queue.consume((batch) => {
			batch.retryAll();
		});
		expect(queue.messages).toHaveLength(1);

		let second = await queue.consume((batch) => {
			batch.retryAll();
		});

		expect(second.deadLettered).toHaveLength(1);
		expect(queue.messages).toHaveLength(0);
		expect(queue.deadLetter.map((message) => message.body.type)).toEqual(["a"]);
	});

	test("delivers at most the configured batch size per pass", async () => {
		let queue = createQueue<Job>({ maxBatchSize: 1 });
		await queue.send({ type: "a" });
		await queue.send({ type: "b" });

		let result = await queue.consume(() => undefined);

		expect(result.delivered).toHaveLength(1);
		expect(queue.messages).toHaveLength(1);
	});

	test("honours a per-pass batch size override", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });
		await queue.send({ type: "b" });

		let result = await queue.consume(() => undefined, { maxBatchSize: 1 });

		expect(result.delivered).toHaveLength(1);
	});

	test("keeps consumed messages in the full send history", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });
		await queue.consume(() => undefined);

		expect(queue.messages).toHaveLength(0);
		expect(queue.sent).toHaveLength(1);
	});

	test("rejects a batch larger than the platform accepts", async () => {
		let queue = createQueue<Job>();
		let requests = Array.from({ length: 101 }, () => ({ body: { type: "a" } }));

		await expect(queue.sendBatch(requests)).rejects.toThrow(/exceeds the limit of 100 messages/);
	});

	test("rejects a delay outside the platform's range", async () => {
		let queue = createQueue<Job>();

		await expect(queue.send({ type: "a" }, { delaySeconds: 50_000 })).rejects.toThrow(
			/delaySeconds/,
		);
	});

	test("rejects a body larger than the platform's message limit", async () => {
		let queue = createQueue<{ blob: string }>();

		await expect(queue.send({ blob: "x".repeat(200_000) })).rejects.toThrow(/exceeds the limit/);
	});

	test("gives every queue its own isolated backlog", async () => {
		let first = createQueue<Job>();
		let second = createQueue<Job>();

		await first.send({ type: "a" });

		expect(second.messages).toHaveLength(0);
	});
	test("clears its backlog and history on reset", async () => {
		let queue = createQueue<Job>();
		await queue.send({ type: "a" });
		await queue.consume((batch) => batch.retryAll());

		queue.reset();

		expect(queue.messages).toHaveLength(0);
		expect(queue.sent).toHaveLength(0);
		expect(queue.deadLetter).toHaveLength(0);
	});
});

describe("createQueue with deferred work", () => {
	/**
	 * Defers `work` past the microtask queue so the drain is genuinely exercised: a
	 * promise chained off `Promise.resolve()` settles on a tick `consume` happens to
	 * yield anyway, proving nothing. A timer is the honest stand-in for real IO.
	 * @param work What the handler put off until after it returned.
	 */
	function defer(work: () => void): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				/**
				 * Settles both ways: a throw inside a timer callback escapes the executor, so
				 * without this catch the promise would never settle and `settled()` would hang.
				 */
				try {
					work();
					resolve();
				} catch (error) {
					reject(error);
				}
			}, 0);
		});
	}

	test("waits for deferred work before reading dispositions", async () => {
		let queue = createQueue<Job>();
		let context = createExecutionContext();

		await queue.send({ type: "sweep" });

		let result = await queue.consume(
			(batch) => {
				for (let message of batch.messages) context.waitUntil(defer(() => message.retry()));
			},
			{ context },
		);

		expect(result.retried).toHaveLength(1);
		expect(result.acked).toHaveLength(0);
		expect(queue.messages).toHaveLength(1);
	});

	test("acks decided in deferred work are honoured", async () => {
		let queue = createQueue<Job>();
		let context = createExecutionContext();

		await queue.send({ type: "sweep" });

		let result = await queue.consume(
			(batch) => {
				for (let message of batch.messages) context.waitUntil(defer(() => message.ack()));
			},
			{ context },
		);

		expect(result.acked).toHaveLength(1);
		expect(queue.messages).toHaveLength(0);
	});

	test("without the context, a deferred decision is missed", async () => {
		let queue = createQueue<Job>();
		let context = createExecutionContext();

		await queue.send({ type: "sweep" });

		/**
		 * Without something draining deferred work, the handler's message is acked on
		 * its behalf before the deferred retry runs — the reason the `context` option
		 * exists.
		 */
		let result = await queue.consume((batch) => {
			for (let message of batch.messages) context.waitUntil(defer(() => message.retry()));
		});

		expect(result.acked).toHaveLength(1);
		expect(result.retried).toHaveLength(0);

		await context.settled();
	});

	test("a rejection in deferred work fails the pass", async () => {
		let queue = createQueue<Job>();
		let context = createExecutionContext();

		await queue.send({ type: "sweep" });

		let consuming = queue.consume(
			() => {
				context.waitUntil(
					defer(() => {
						throw new Error("job blew up");
					}),
				);
			},
			{ context },
		);

		await expect(consuming).rejects.toThrow("job blew up");

		/**
		 * Deferred work that failed decided nothing, so the message goes back for
		 * another try.
		 */
		expect(queue.messages).toHaveLength(1);
	});
});
