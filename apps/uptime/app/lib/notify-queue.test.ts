/**
 * Unit tests for the `notify` message enqueuer: the message bodies it puts on the queue,
 * that an empty sweep sends nothing at all, and that more notifications than a single
 * `sendBatch` accepts are split across calls. The `QUEUE` binding is faked through
 * `cloudflare:workers`, which is the only Workers API this module touches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { NotifyMessage } from "~/app/lib/notify-queue";

interface SendRequest {
	body: NotifyMessage;
	contentType: string;
}

let sendBatchCalls: SendRequest[][] = [];
let sendBatchMock = mock(async (requests: SendRequest[]) => {
	sendBatchCalls.push([...requests]);
});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { sendBatch: sendBatchMock, send: async () => {} } },
}));

let { enqueueNotifications } = await import("~/app/lib/notify-queue");

function makeMessage(monitorId: string): NotifyMessage {
	return {
		type: "notify",
		monitorType: "tcp",
		monitorId,
		previousStatus: "up",
		newStatus: "down",
	};
}

beforeEach(() => {
	sendBatchMock.mockClear();
	sendBatchCalls = [];
});

describe("enqueueNotifications", () => {
	test("sends one JSON message per notification", async () => {
		await enqueueNotifications([makeMessage("monitor-1"), makeMessage("monitor-2")]);

		expect(sendBatchCalls).toHaveLength(1);
		expect(sendBatchCalls[0]).toEqual([
			{ body: makeMessage("monitor-1"), contentType: "json" },
			{ body: makeMessage("monitor-2"), contentType: "json" },
		]);
	});

	/**
	 * A domain sweep's findings are durable in `dns_monitor_records` and the consumer reads
	 * them from there, so the message stays two statuses and an id. A copy on the queue
	 * would be replayed as fact by a redelivery that arrives long after it stopped being
	 * true.
	 */
	test("puts nothing but the transition on the wire for a domain monitor", async () => {
		let message: NotifyMessage = {
			type: "notify",
			monitorType: "dns",
			monitorId: "dns-monitor-1",
			previousStatus: "ok",
			newStatus: "changed",
		};

		await enqueueNotifications([message]);

		expect(sendBatchCalls[0]).toEqual([{ body: message, contentType: "json" }]);
		expect(Object.keys(sendBatchCalls[0]![0]!.body)).toEqual([
			"type",
			"monitorType",
			"monitorId",
			"previousStatus",
			"newStatus",
		]);
	});

	test("sends nothing when the sweep produced no notifications", async () => {
		await enqueueNotifications([]);

		expect(sendBatchMock).not.toHaveBeenCalled();
	});

	test("splits more notifications than one batch accepts across calls", async () => {
		let messages = Array.from({ length: 150 }, (_value, index) => makeMessage(`monitor-${index}`));

		await enqueueNotifications(messages);

		expect(sendBatchCalls.map((batch) => batch.length)).toEqual([100, 50]);
	});
});
