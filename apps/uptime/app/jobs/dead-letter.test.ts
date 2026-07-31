/**
 * Unit tests for the dead-letter queue consumer: it tells a wrapped validation failure from
 * a retry-exhausted body, and — the property the DLQ depends on — it acks every message it
 * is handed, including one whose body it can make no sense of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { DeadLetterJob } from "~/app/jobs/dead-letter";

let ack = mock();
let retry = mock();
let consoleError = spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
	ack.mockReset();
	retry.mockReset();
	consoleError.mockClear();
});

/** Runs the consumer over one body and returns the events it flushed. */
function run(body: unknown, attempts = 1) {
	let message: Message<unknown> = {
		id: "dlq-message-1",
		timestamp: new Date(),
		body,
		attempts,
		ack,
		retry,
	};

	DeadLetterJob.run(message);

	let call = consoleError.mock.calls.at(0);
	return { identifier: call?.at(0), output: call?.at(1) };
}

describe("DeadLetterJob.run", () => {
	test("records a retry-exhausted body with its job type, attempts, and payload", () => {
		let body = { type: "checkHttp", id: "job-1", monitorId: "monitor-1", scheduledAt: 1 };

		let { identifier, output } = run(body, 2);

		/** Same shape `Job.run` gives every other job, so both filter together. */
		expect(identifier).toBe("job:dead-letter-job:dlq-message-1");
		expect(output).toMatchObject({
			events: [
				{
					level: "error",
					event: "job.dead_letter.retries_exhausted",
					attempts: 2,
					type: "checkHttp",
					body,
				},
			],
		});
	});

	test("records a wrapped validation failure as the other kind, unwrapping the payload", () => {
		let { output } = run({ invalid: { type: 7 } });

		expect(output).toMatchObject({
			events: [{ level: "error", event: "job.dead_letter.invalid_message", body: { type: 7 } }],
		});
	});

	test("acks every message and never retries one, whatever the body", () => {
		for (let body of [{ type: "clean" }, { invalid: "not-json" }, null, undefined, 42]) {
			ack.mockReset();
			run(body);
			expect(ack).toHaveBeenCalledTimes(1);
			expect(retry).not.toHaveBeenCalled();
		}
	});
});
