import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";

import { Message } from "@cloudflare/workers-types";
import { isFailure } from "@pkg/result";
import { JSONValue } from "@pkg/types";
import { validate } from "@pkg/validate";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";

import { Job } from "./index";

const UPTIME_URL = "https://uptime.sergiodxa.com";
const MONITOR_ID = "test-monitor-123";
const UPTIME_TOKEN = "test-token";

// MSW server setup
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Console mocks
let consoleInfoSpy: ReturnType<typeof spyOn>;
let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	consoleInfoSpy.mockRestore();
	consoleErrorSpy.mockRestore();
});

// Message mocks
let retryMock = mock();
let ackMock = mock();

beforeEach(() => {
	retryMock.mockReset();
	ackMock.mockReset();
});

function createMessage<T extends JSONValue>(body: T): Message<T> {
	return {
		id: crypto.randomUUID(),
		timestamp: new Date(),
		body,
		attempts: 0,
		retry: retryMock,
		ack: ackMock,
	};
}

// Job subclasses for testing
class SuccessfulJob extends Job {
	static schema = z.object({ teamId: z.string() });

	async perform(): Promise<void> {
		let result = await validate(this.input, SuccessfulJob.schema);
		if (isFailure(result)) throw new Job.NonRetriableError("Invalid input");
		this.logger.info("job.doing-work", { teamId: result.data.teamId });
	}
}

class SuccessfulJobWithMonitor extends Job {
	static monitorId = MONITOR_ID;
	static schema = z.object({ teamId: z.string() });

	async perform(): Promise<void> {
		let result = await validate(this.input, SuccessfulJobWithMonitor.schema);
		if (isFailure(result)) throw new Job.NonRetriableError("Invalid input");
		this.logger.info("job.doing-work", { teamId: result.data.teamId });
	}
}

class RetryableJob extends Job {
	async perform(): Promise<void> {
		throw new Job.RetryError("Transient failure");
	}
}

class RetryableJobWithCause extends Job {
	async perform(): Promise<void> {
		let cause = new Error("Original error");
		throw new Job.RetryError("Transient failure", { cause });
	}
}

class NonRetriableJob extends Job {
	async perform(): Promise<void> {
		throw new Job.NonRetriableError("Invalid input");
	}
}

class NonRetriableJobWithCause extends Job {
	async perform(): Promise<void> {
		let cause = new Error("Validation error");
		throw new Job.NonRetriableError("Invalid input", { cause });
	}
}

class UnexpectedErrorJob extends Job {
	async perform(): Promise<void> {
		throw new Error("Something went wrong");
	}
}

describe(Job.name, () => {
	describe("successful job without uptime", () => {
		test("runs perform, acks message, and logs correctly", async () => {
			let message = createMessage({ teamId: "team-123" });

			await SuccessfulJob.run({ message });

			expect(ackMock).toHaveBeenCalledTimes(1);
			expect(retryMock).not.toHaveBeenCalled();
			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).not.toHaveBeenCalled();

			// Verify log structure
			let [identifier, logData] = consoleInfoSpy.mock.calls[0];
			expect(identifier).toMatch(/^job:successful-job:/);
			expect(logData.events).toHaveLength(3);
			expect(logData.events[0].event).toBe("job.started");
			expect(logData.events[1].event).toBe("job.doing-work");
			expect(logData.events[2].event).toBe("job.completed");
		});
	});

	describe("successful job with uptime ping", () => {
		test("pings uptime service after successful perform", async () => {
			let uptimePinged = false;

			server.use(
				http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, ({ request }) => {
					uptimePinged = true;
					expect(request.headers.get("Authorization")).toBe(`Bearer ${UPTIME_TOKEN}`);
					return HttpResponse.json({ success: true });
				}),
			);

			let message = createMessage({ teamId: "team-123" });

			await SuccessfulJobWithMonitor.run({
				message,
				uptime: { token: UPTIME_TOKEN },
			});

			expect(uptimePinged).toBe(true);
			expect(ackMock).toHaveBeenCalledTimes(1);
			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("uptime ping HTTP error", () => {
		test("acks message and logs info when uptime returns HTTP error", async () => {
			server.use(
				http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, () => {
					return HttpResponse.text("Unauthorized", { status: 401 });
				}),
			);

			let message = createMessage({ teamId: "team-123" });

			await SuccessfulJobWithMonitor.run({
				message,
				uptime: { token: UPTIME_TOKEN },
			});

			// Job should still ack (uptime failure doesn't fail the job)
			expect(ackMock).toHaveBeenCalledTimes(1);
			expect(retryMock).not.toHaveBeenCalled();

			// Should log at info level for uptime failures
			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);

			let [identifier, logData] = consoleInfoSpy.mock.calls[0];
			expect(identifier).toMatch(/^job:successful-job-with-monitor:/);

			// Should have job.started, job.doing-work, job.uptime-failed
			expect(logData.events).toHaveLength(3);
			expect(logData.events[0].event).toBe("job.started");
			expect(logData.events[1].event).toBe("job.doing-work");
			expect(logData.events[2].event).toBe("job.uptime-failed");
			expect(logData.events[2].error.name).toBe("FetchError");
		});
	});

	describe("uptime ping network error", () => {
		test("acks message and logs info when network fails", async () => {
			server.use(
				http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, () => {
					return HttpResponse.error();
				}),
			);

			let message = createMessage({ teamId: "team-123" });

			await SuccessfulJobWithMonitor.run({
				message,
				uptime: { token: UPTIME_TOKEN },
			});

			// Job should still ack (uptime failure doesn't fail the job)
			expect(ackMock).toHaveBeenCalledTimes(1);
			expect(retryMock).not.toHaveBeenCalled();

			// Should log at info level for network failures
			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);

			let [identifier, logData] = consoleInfoSpy.mock.calls[0];
			expect(identifier).toMatch(/^job:successful-job-with-monitor:/);

			expect(logData.events).toHaveLength(3);
			expect(logData.events[2].event).toBe("job.uptime-failed");
			expect(logData.events[2].error.name).toBe("NetworkError");
		});
	});

	describe("RetryError handling", () => {
		test("retries message and logs error when RetryError is thrown", async () => {
			let message = createMessage({ teamId: "team-123" });

			await RetryableJob.run({ message });

			expect(retryMock).toHaveBeenCalledTimes(1);
			expect(ackMock).not.toHaveBeenCalled();

			// Should log at error level
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

			let [identifier, logData] = consoleErrorSpy.mock.calls[0];
			expect(identifier).toMatch(/^job:retryable-job:/);

			expect(logData.events).toHaveLength(2);
			expect(logData.events[0].event).toBe("job.started");
			expect(logData.events[1].event).toBe("job.retrying");
			expect(logData.events[1].error.name).toBe("RetryError");
			expect(logData.events[1].error.message).toBe("Transient failure");
		});

		test("preserves cause when provided", async () => {
			let message = createMessage({ teamId: "team-123" });

			await RetryableJobWithCause.run({ message });

			expect(retryMock).toHaveBeenCalledTimes(1);

			let [, logData] = consoleErrorSpy.mock.calls[0];
			expect(logData.events[1].error.message).toBe("Transient failure");
		});
	});

	describe("NonRetriableError handling", () => {
		test("acks message and logs error when NonRetriableError is thrown", async () => {
			let message = createMessage({ teamId: "team-123" });

			await NonRetriableJob.run({ message });

			expect(ackMock).toHaveBeenCalledTimes(1);
			expect(retryMock).not.toHaveBeenCalled();

			// Should log at error level
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

			let [identifier, logData] = consoleErrorSpy.mock.calls[0];
			expect(identifier).toMatch(/^job:non-retriable-job:/);

			expect(logData.events).toHaveLength(2);
			expect(logData.events[0].event).toBe("job.started");
			expect(logData.events[1].event).toBe("job.non-retriable");
			expect(logData.events[1].error.name).toBe("NonRetriableError");
			expect(logData.events[1].error.message).toBe("Invalid input");
		});

		test("preserves cause when provided", async () => {
			let message = createMessage({ teamId: "team-123" });

			await NonRetriableJobWithCause.run({ message });

			expect(ackMock).toHaveBeenCalledTimes(1);

			let [, logData] = consoleErrorSpy.mock.calls[0];
			expect(logData.events[1].error.message).toBe("Invalid input");
		});
	});

	describe("unexpected error handling", () => {
		test("logs error and re-throws for Cloudflare to handle", async () => {
			let message = createMessage({ teamId: "team-123" });

			await expect(UnexpectedErrorJob.run({ message })).rejects.toThrow("Something went wrong");

			// Should not call ack or retry - let Cloudflare handle it
			expect(ackMock).not.toHaveBeenCalled();
			expect(retryMock).not.toHaveBeenCalled();

			// Should log at error level
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

			let [identifier, logData] = consoleErrorSpy.mock.calls[0];
			expect(identifier).toMatch(/^job:unexpected-error-job:/);

			expect(logData.events).toHaveLength(2);
			expect(logData.events[0].event).toBe("job.started");
			expect(logData.events[1].event).toBe("job.failed");
			expect(logData.events[1].error.name).toBe("Error");
			expect(logData.events[1].error.message).toBe("Something went wrong");
		});
	});

	describe("job identifier format", () => {
		test("converts PascalCase job name to kebab-case in identifier", async () => {
			let message = createMessage({ teamId: "team-123" });

			await SuccessfulJob.run({ message });

			let [identifier] = consoleInfoSpy.mock.calls[0];
			expect(identifier).toMatch(/^job:successful-job:[a-f0-9-]+$/);
		});
	});

	describe("message attempts tracking", () => {
		test("includes attempts count in logs", async () => {
			let message = createMessage({ teamId: "team-123" });
			// @ts-expect-error - modifying readonly property for testing
			message.attempts = 3;

			await SuccessfulJob.run({ message });

			let [, logData] = consoleInfoSpy.mock.calls[0];
			expect(logData.events[0].attempts).toBe(3);
			expect(logData.events[2].attempts).toBe(3);
		});
	});

	describe("no uptime config", () => {
		test("skips uptime ping when not configured", async () => {
			let uptimePinged = false;

			server.use(
				http.post(`${UPTIME_URL}/api/v1/cron-jobs/:monitorId/ping`, () => {
					uptimePinged = true;
					return HttpResponse.json({ success: true });
				}),
			);

			let message = createMessage({ teamId: "team-123" });

			await SuccessfulJob.run({ message });

			expect(uptimePinged).toBe(false);
			expect(ackMock).toHaveBeenCalledTimes(1);
		});

		test("skips uptime ping when token is missing", async () => {
			let uptimePinged = false;

			server.use(
				http.post(`${UPTIME_URL}/api/v1/cron-jobs/:monitorId/ping`, () => {
					uptimePinged = true;
					return HttpResponse.json({ success: true });
				}),
			);

			let message = createMessage({ teamId: "team-123" });

			await SuccessfulJob.run({
				message,
				// @ts-expect-error - testing partial config
				uptime: { monitorId: MONITOR_ID },
			});

			expect(uptimePinged).toBe(false);
		});

		test("skips uptime ping when job has no static monitorId", async () => {
			let uptimePinged = false;

			server.use(
				http.post(`${UPTIME_URL}/api/v1/cron-jobs/:monitorId/ping`, () => {
					uptimePinged = true;
					return HttpResponse.json({ success: true });
				}),
			);

			let message = createMessage({ teamId: "team-123" });

			// SuccessfulJob doesn't have static monitorId, so uptime ping should be skipped
			await SuccessfulJob.run({
				message,
				uptime: { token: UPTIME_TOKEN },
			});

			expect(uptimePinged).toBe(false);
		});
	});

	describe("input validation pattern", () => {
		test("throws NonRetriableError on invalid input", async () => {
			let message = createMessage({ invalidField: "not-a-teamId" });

			await SuccessfulJob.run({ message });

			expect(ackMock).toHaveBeenCalledTimes(1);
			expect(retryMock).not.toHaveBeenCalled();

			let [, logData] = consoleErrorSpy.mock.calls[0];
			expect(logData.events[1].event).toBe("job.non-retriable");
		});
	});
});
