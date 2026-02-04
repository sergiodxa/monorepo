import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";

import { RouterContextProvider } from "react-router";

import {
	logger,
	BatchedLogger,
	LoggerContext,
	createLoggerMiddleware,
	getLoggerFromContext,
} from "./index";

describe("logger (singleton)", () => {
	let consoleInfoSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let dateNowSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		dateNowSpy = spyOn(Date, "now").mockReturnValue(1738590000000);
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		dateNowSpy.mockRestore();
	});

	describe("logger.info", () => {
		test("calls console.info with correct structure", () => {
			logger.info("test_event");

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("includes payload in output", () => {
			logger.info("user_subscribed", { email: "test@example.com", source: "homepage" });

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				email: "test@example.com",
				source: "homepage",
				event: "user_subscribed",
				timestamp: 1738590000000,
			});
		});
	});

	describe("logger.error", () => {
		test("calls console.error with correct structure", () => {
			logger.error("test_error");

			expect(consoleErrorSpy).toHaveBeenCalledWith({
				event: "test_error",
				timestamp: 1738590000000,
			});
		});

		test("includes payload in output", () => {
			logger.error("api_failure", { service: "buttondown", status: 500 });

			expect(consoleErrorSpy).toHaveBeenCalledWith({
				service: "buttondown",
				status: 500,
				event: "api_failure",
				timestamp: 1738590000000,
			});
		});
	});

	describe("payload handling", () => {
		test("payload properties do not override event or timestamp", () => {
			logger.info("test_event", {
				event: "custom_event",
				timestamp: 0,
			});

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("handles undefined payload", () => {
			logger.info("test_event", undefined);

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("handles empty payload", () => {
			logger.info("test_event", {});

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});
	});
});

describe("BatchedLogger", () => {
	let consoleInfoSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let dateNowSpy: ReturnType<typeof spyOn>;

	let testRequest = new Request("https://example.com/test");

	beforeEach(() => {
		consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		dateNowSpy = spyOn(Date, "now").mockReturnValue(1738590000000);
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		dateNowSpy.mockRestore();
	});

	describe("accumulation", () => {
		test("does not log immediately when calling info/error", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.info("event1");
			batchedLogger.error("event2");

			expect(consoleInfoSpy).not.toHaveBeenCalled();
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});
	});

	describe("flush", () => {
		test("outputs all events in a single console call with request info", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.info("event1", { key: "value1" });
			batchedLogger.info("event2", { key: "value2" });
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			expect(consoleInfoSpy).toHaveBeenCalledWith("GET https://example.com/test", {
				timestamp: 1738590000000,
				events: [
					{ level: "info", event: "event1", key: "value1" },
					{ level: "info", event: "event2", key: "value2" },
				],
			});
		});

		test("uses console.error when any error is present", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.info("info_event");
			batchedLogger.error("error_event");
			batchedLogger.flush();

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleInfoSpy).not.toHaveBeenCalled();
		});

		test("uses console.info when only info events are present", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.info("info_event1");
			batchedLogger.info("info_event2");
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		test("clears events after flushing", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.info("event1");
			batchedLogger.flush();
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
		});

		test("does nothing when no events are accumulated", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.flush();

			expect(consoleInfoSpy).not.toHaveBeenCalled();
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		test("includes level in each event output", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.info("info_event");
			batchedLogger.error("error_event");
			batchedLogger.flush();

			expect(consoleErrorSpy).toHaveBeenCalledWith("GET https://example.com/test", {
				timestamp: 1738590000000,
				events: [
					{ level: "info", event: "info_event" },
					{ level: "error", event: "error_event" },
				],
			});
		});

		test("includes payload in event output", () => {
			let batchedLogger = new BatchedLogger(testRequest);

			batchedLogger.info("user_subscribed", { email: "test@example.com", source: "homepage" });
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith("GET https://example.com/test", {
				timestamp: 1738590000000,
				events: [
					{
						level: "info",
						event: "user_subscribed",
						email: "test@example.com",
						source: "homepage",
					},
				],
			});
		});

		test("includes correct method for POST requests", () => {
			let postRequest = new Request("https://example.com/api/subscribe", { method: "POST" });
			let batchedLogger = new BatchedLogger(postRequest);

			batchedLogger.info("subscription_created");
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"POST https://example.com/api/subscribe",
				expect.any(Object),
			);
		});
	});
});

describe("middleware", () => {
	let consoleInfoSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let dateNowSpy: ReturnType<typeof spyOn>;

	let testRequest = new Request("https://example.com/test");

	beforeEach(() => {
		consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		dateNowSpy = spyOn(Date, "now").mockReturnValue(1738590000000);
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		dateNowSpy.mockRestore();
	});

	describe("createLoggerMiddleware", () => {
		test("creates a BatchedLogger and stores it in context", async () => {
			let middleware = createLoggerMiddleware();
			let context = new RouterContextProvider();
			let capturedLogger: BatchedLogger | undefined;

			await middleware({ context, request: testRequest }, async () => {
				capturedLogger = context.get(LoggerContext);
				return new Response("OK");
			});

			expect(capturedLogger).toBeInstanceOf(BatchedLogger);
		});

		test("flushes logger after handler completes", async () => {
			let middleware = createLoggerMiddleware();
			let context = new RouterContextProvider();

			await middleware({ context, request: testRequest }, async () => {
				let logger = context.get(LoggerContext)!;
				logger.info("test_event");
				return new Response("OK");
			});

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
		});

		test("flushes logger even if handler throws", async () => {
			let middleware = createLoggerMiddleware();
			let context = new RouterContextProvider();

			try {
				await middleware({ context, request: testRequest }, async () => {
					let logger = context.get(LoggerContext)!;
					logger.error("error_before_throw");
					throw new Error("Handler error");
				});
			} catch {
				// Expected
			}

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		});

		test("returns the response from the handler", async () => {
			let middleware = createLoggerMiddleware();
			let context = new RouterContextProvider();

			let response = await middleware({ context, request: testRequest }, async () => {
				return new Response("Test body", { status: 201 });
			});

			expect(response.status).toBe(201);
			expect(await response.text()).toBe("Test body");
		});
	});

	describe("getLoggerFromContext", () => {
		test("retrieves the BatchedLogger from context", async () => {
			let middleware = createLoggerMiddleware();
			let context = new RouterContextProvider();

			await middleware({ context, request: testRequest }, async () => {
				let logger = getLoggerFromContext(context);
				expect(logger).toBeInstanceOf(BatchedLogger);
				return new Response("OK");
			});
		});

		test("throws error if logger middleware was not used", () => {
			let context = new RouterContextProvider();

			// React Router's context.get throws "No value found for context" when key doesn't exist
			expect(() => getLoggerFromContext(context)).toThrow();
		});
	});
});
