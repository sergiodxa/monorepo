/**
 * Unit tests for the `notify` message enqueuer: the message bodies it puts on the queue,
 * that an empty sweep sends nothing at all, and that more notifications than a single
 * `sendBatch` accepts are split across calls. The `QUEUE` binding is an in-memory queue
 * installed through `cloudflare:workers`, the only Workers API this module touches, so the
 * assertions are about the messages that really landed on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@pkg/cloudflare-mocks";

import { createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotifyMessage } from "~/app/lib/notify-queue";

/**
 * The queue the enqueuer sends to. It lives at module scope because the module under test
 * captures `env` on import, and it enforces the platform's 100-message batch ceiling, so
 * a chunking bug fails here as a rejected send rather than as a silently oversized batch.
 */
let queue: QueueMock<NotifyMessage> = createQueue<NotifyMessage>({ name: "notify" });

/** Batch boundaries are not recoverable from the recorded messages, so `sendBatch` is spied on too. */
let sendBatch = vi.spyOn(queue, "sendBatch");

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let { enqueueNotifications } = await import("~/app/lib/notify-queue");

function makeMessage(monitorId: string): NotifyMessage {
	return {
		monitorType: "tcp",
		monitorId,
		previousStatus: "up",
		newStatus: "down",
	};
}

/** The body one notification lands on the queue as: its own fields, plus the job's name. */
function makeBody(monitorId: string) {
	return { ...makeMessage(monitorId), type: "notify" };
}

beforeEach(() => {
	queue.reset();
	sendBatch.mockClear();
});

describe("enqueueNotifications", () => {
	test("sends one JSON message per notification", async () => {
		await enqueueNotifications([makeMessage("monitor-1"), makeMessage("monitor-2")]);

		expect(sendBatch).toHaveBeenCalledTimes(1);
		expect(
			queue.sent.map((message) => ({ body: message.body, type: message.contentType })),
		).toEqual([
			{ body: makeBody("monitor-1"), type: "json" },
			{ body: makeBody("monitor-2"), type: "json" },
		]);
	});

	/**
	 * A domain sweep's findings live in `dns_monitor_records`, so the message carries just
	 * the two statuses and an id — a redelivered copy could otherwise be replayed as fact
	 * long after it stopped being true.
	 */
	test("puts nothing but the transition on the wire for a domain monitor", async () => {
		let message: NotifyMessage = {
			monitorType: "dns",
			monitorId: "dns-monitor-1",
			previousStatus: "ok",
			newStatus: "changed",
		};

		await enqueueNotifications([message]);

		expect(queue.sent.map((sent) => sent.body)).toEqual([{ ...message, type: "notify" }]);
		expect(Object.keys(queue.sent[0]!.body)).toEqual([
			"monitorType",
			"monitorId",
			"previousStatus",
			"newStatus",
			"type",
		]);
	});

	test("sends nothing when the sweep produced no notifications", async () => {
		await enqueueNotifications([]);

		expect(sendBatch).not.toHaveBeenCalled();
		expect(queue.sent).toHaveLength(0);
	});

	test("splits more notifications than one batch accepts across calls", async () => {
		let messages = Array.from({ length: 150 }, (_value, index) => makeMessage(`monitor-${index}`));

		await enqueueNotifications(messages);

		expect(sendBatch.mock.calls.map(([requests]) => [...requests].length)).toEqual([100, 50]);
		expect(queue.sent).toHaveLength(150);
	});
});
