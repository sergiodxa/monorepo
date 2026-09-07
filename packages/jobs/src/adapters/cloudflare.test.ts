/**
 * Exercises the Cloudflare backend against the platform's own limits: the envelope and
 * content type it writes, the batch ceiling it chunks at, the delay it refuses rather than
 * shortens, and the failure it reports when the binding will not take a write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Queue } from "@cloudflare/workers-types";

import { createQueue } from "@sdxc/cloudflare-mocks";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test, vi } from "vitest";

import type { JobMessage } from "../queue.js";

import { queue } from "./cloudflare.js";

/** The adapter over a recording binding, plus the binding itself. */
function setup() {
	let binding = createQueue({ name: "ping" });

	return {
		binding,
		sendBatch: vi.spyOn(binding, "sendBatch"),
		platform: queue(() => binding as unknown as Queue),
	};
}

describe("queue()", () => {
	test("leaves the retry ceiling to the platform", () => {
		let { platform } = setup();

		expect(platform.retries).toBe("backend");
	});

	test("writes the envelope as JSON", async () => {
		let { binding, platform } = setup();

		unwrap(await platform.send([{ job: "checkHttp", body: { monitorId: "m1" } }]));

		expect(binding.sent).toEqual([
			expect.objectContaining({
				body: { job: "checkHttp", body: { monitorId: "m1" } },
				contentType: "json",
			}),
		]);
	});

	test("writes no body for a job that carries no payload", async () => {
		let { binding, platform } = setup();

		unwrap(await platform.send([{ job: "clean" }]));

		expect(binding.messages.map((message) => message.body)).toEqual([{ job: "clean" }]);
	});

	test("resolves the binding per call, so importing a producer touches none", async () => {
		let binding = createQueue({ name: "ping" });
		let reads = 0;
		let platform = queue(() => {
			reads += 1;
			return binding as unknown as Queue;
		});

		expect(reads).toBe(0);

		unwrap(await platform.send([{ job: "clean" }]));

		expect(reads).toBe(1);
	});

	test("enqueues nothing for an empty list", async () => {
		let { sendBatch, platform } = setup();

		unwrap(await platform.send([]));

		expect(sendBatch).not.toHaveBeenCalled();
	});

	test("chunks a batch past the ceiling a single write accepts", async () => {
		let { binding, sendBatch, platform } = setup();
		let messages: JobMessage[] = Array.from({ length: 250 }, () => ({ job: "clean" }));

		unwrap(await platform.send(messages));

		expect(sendBatch).toHaveBeenCalledTimes(3);
		expect(binding.messages).toHaveLength(250);
	});

	test("carries a delay the platform can hold", async () => {
		let { binding, platform } = setup();

		unwrap(await platform.send([{ job: "clean", delay: "5 minutes" }]));

		expect(binding.sent).toEqual([expect.objectContaining({ delaySeconds: 300 })]);
	});

	test("refuses a delay longer than a message is held for, rather than shortening it", async () => {
		let { sendBatch, platform } = setup();

		let result = await platform.send([{ job: "clean", delay: "3 days" }]);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("unsupported_delay");
		expect(sendBatch).not.toHaveBeenCalled();
	});

	test("refuses the whole batch when one message asks to be held too long", async () => {
		let { sendBatch, platform } = setup();

		let result = await platform.send([{ job: "clean" }, { job: "clean", delay: "3 days" }]);

		expect(isSuccess(result)).toBe(false);
		expect(sendBatch).not.toHaveBeenCalled();
	});

	test("reports a binding that refuses the write, carrying the original as its cause", async () => {
		let refused = new Error("queue is over its backlog limit");
		let platform = queue(() => ({ sendBatch: () => Promise.reject(refused) }) as unknown as Queue);

		let result = await platform.send([{ job: "clean" }]);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.code).toBe("unavailable");
			expect(result.error.cause).toBe(refused);
		}
	});
});
